import { Prisma } from '.prisma/client';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isBefore, parseJSON } from 'date-fns';
import { orderBy } from 'lodash';
import { PrismaService } from 'src/prisma.service';
import { SubmitProofDto } from 'src/proofs/dto/submit-proof.dto';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import {
  ChallengeData,
  ChallengeList,
  UserMini,
} from './entities/challenge.entity';
import { VetoedParticipantsDto } from './dto/vetoed-participants.dto';
import { WsException } from '@nestjs/websockets';
import { SubmitVoteDto } from 'src/votes/dto/submit-vote.dto';
import { VoteData } from 'src/votes/votes.entities';

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

  // checks if challenge start is before its end
  private isStartBeforeEnd(start: Date | null, end: Date): boolean {
    if (!start) {
      return true;
    }
    return isBefore(start, end);
  }

  // checks if the user has accepted the challenge
  private hasUserAccepted(joinedAt: Date) {
    return !!joinedAt;
  }

  // checks if the challenge is over
  private isChallengeOver(end: Date): boolean {
    return !isBefore(new Date(), end);
  }

  // checks if the challenge has started
  private hasChallengeStarted(start: Date | null): boolean {
    if (!start) {
      return false;
    }
    return isBefore(start, new Date());
  }

  private countAccusers(
    votes: {
      victimId: string;
      accuserId: string;
    }[],
  ): Map<string, string[]> {
    const map: Map<string, string[]> = new Map();
    for (const v of votes) {
      if (map.has(v.victimId)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const list = map.get(v.victimId)!;
        list.push(v.accuserId);
        map.set(v.victimId, list);
      } else {
        map.set(v.victimId, [v.accuserId]);
      }
    }
    return map;
  }

  async create(
    userId: string,
    createChallengeDto: CreateChallengeDto,
  ): Promise<void> {
    const { participants } = createChallengeDto;
    const qUserIds: { userId: string; joined_at?: Date }[] =
      await this.prisma.user.findMany({
        where: {
          userId: { in: participants },
        },
        select: {
          userId: true,
        },
      });

    const pUserIds = qUserIds.filter((p) => p.userId !== userId);
    pUserIds.push({ userId, joined_at: new Date() });

    const { title, description, startAt, endAt, type } = createChallengeDto;
    await this.prisma.challenge.create({
      data: {
        title,
        description,
        startAt,
        endAt,
        type,
        ownerId: userId,
        participants: {
          createMany: {
            data: pUserIds,
            skipDuplicates: true,
          },
        },
      },
    });
  }

  async findAll(userId: string): Promise<ChallengeList> {
    const participatingInstances = await this.prisma.participant.findMany({
      where: {
        userId,
      },
      include: {
        challenge: {
          include: {
            owner: true,
            participants: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        challenge: {
          startAt: 'asc',
        },
      },
    });
    /** */
    const ongoing: ChallengeData[] = [];
    const pendingStart: ChallengeData[] = [];
    const pendingResponse: ChallengeData[] = [];
    const history: ChallengeData[] = [];

    /* eslint-disable @typescript-eslint/no-non-null-assertion,no-inner-declarations */
    for (const participantOf of participatingInstances) {
      // allow to do this cause of typing issue of participantOf.challenge
      // by right should check how to type this properly outside
      // allow for !. in this block => assume that username, name, avatars are all present
      // see  `POST challenges/`, `PATCH challenges/:challengeId`, `POST challenges/accept`,
      // these are the endpoints that insert rows into participants, and they check for these fields to exist
      function formatChallenge(
        c: typeof participantOf.challenge,
      ): ChallengeData {
        const { owner, participants } = c;

        const accepted: UserMini[] = [];
        const pending: UserMini[] = [];
        const notCompleted: UserMini[] = [];
        const completed: UserMini[] = [];

        // for this challenge, organise it into accepted and pending users
        for (const participant of participants) {
          const {
            userId,
            username,
            name,
            avatar_animal,
            avatar_bg,
            avatar_color,
          } = participant.user;
          if (participant.joined_at === null) {
            pending.push({
              userId: userId,
              username: username!,
              name: name!,
              hasBeenVetoed: participant.has_been_vetoed,
              completedAt: participant.completed_at?.toISOString(),
              evidenceLink: participant.evidence_link ?? undefined,
              avatar: {
                animal: avatar_animal!,
                background: avatar_bg!,
                color: avatar_color!,
              },
            });
          } else {
            // user has joined
            if (participant.completed_at) {
              // completed
              completed.push({
                userId: userId,
                username: username!,
                name: name!,
                avatar: {
                  animal: avatar_animal!,
                  background: avatar_bg!,
                  color: avatar_color!,
                },
                completedAt: participant.completed_at?.toISOString(),
                evidenceLink: participant.evidence_link ?? undefined,
                hasBeenVetoed: participant.has_been_vetoed,
              });
            } else {
              // not completed
              notCompleted.push({
                userId: userId,
                username: username!,
                name: name!,
                completedAt: undefined,
                evidenceLink: undefined,
                hasBeenVetoed: participant.has_been_vetoed,
                avatar: {
                  animal: avatar_animal!,
                  background: avatar_bg!,
                  color: avatar_color!,
                },
              });
            }
          }
        }

        // format the challenge
        return {
          challengeId: c.challengeId,
          title: c.title,
          description: c.description ?? undefined,
          startAt: c.startAt ? c.startAt.toISOString() : null,
          endAt: c.endAt.toISOString(),
          type: c.type,
          hasReleasedResult: c.has_released_result,
          owner: {
            userId: owner.userId,
            username: owner.username!,
            name: owner.name!,
            avatar: {
              animal: owner.avatar_animal!,
              background: owner.avatar_bg!,
              color: owner.avatar_color!,
            },
          },
          participantCount: accepted.length,
          participants: {
            accepted: {
              completed,
              notCompleted,
            },
            pending,
          },
        };
      }

      const c: ChallengeData = formatChallenge(participantOf.challenge);

      if (
        this.isChallengeOver(participantOf.challenge.endAt) &&
        this.hasUserAccepted(participantOf.joined_at)
      ) {
        // history
        history.push(c);
      } else if (
        this.hasUserAccepted(participantOf.joined_at) &&
        this.hasChallengeStarted(participantOf.challenge.startAt)
      ) {
        // ongoing: user accepted + challenge has started
        ongoing.push(c);
      } else if (
        this.hasUserAccepted(participantOf.joined_at) &&
        !this.hasChallengeStarted(participantOf.challenge.startAt)
      ) {
        // pendingStart: user accepted + challenge not started
        pendingStart.push(c);
      } else if (
        !this.hasUserAccepted(participantOf.joined_at) &&
        !this.hasChallengeStarted(participantOf.challenge.startAt)
      ) {
        // pendingResponse: user has not accepted + challenge not started
        pendingResponse.push(c);
      }
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion,no-inner-declarations */

    // TODO: see if the interface needs to be changed since client can organise it

    const sortedHistory: ChallengeData[] = orderBy(history, ['endAt'], 'desc');
    return {
      ongoing,
      pendingStart,
      pendingResponse,
      history: sortedHistory,
    };
  }

  async findOne(challengeId: string): Promise<ChallengeData | null> {
    const challenge = await this.prisma.challenge.findUnique({
      where: {
        challengeId,
      },
      include: {
        owner: true,
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!challenge) {
      return null;
    }

    const pending: UserMini[] = [];
    const notCompleted: UserMini[] = [];
    const completed: UserMini[] = [];

    for (const participant of challenge.participants) {
      const { username, name, userId, avatar_animal, avatar_color, avatar_bg } =
        participant.user;

      // do not include any users not properly initiated
      if (!username || !name || !avatar_animal || !avatar_color || !avatar_bg) {
        continue;
      }

      const formattedUser: UserMini = {
        userId,
        username,
        name,
        avatar: {
          animal: avatar_animal,
          color: avatar_color,
          background: avatar_bg,
        },
        completedAt: participant.completed_at?.toISOString(),
        evidenceLink: participant.evidence_link ?? undefined,
        hasBeenVetoed: participant.has_been_vetoed,
      };

      if (participant.joined_at) {
        if (participant.completed_at) {
          completed.push(formattedUser);
        } else {
          notCompleted.push(formattedUser);
        }
      } else {
        pending.push(formattedUser);
      }
    }

    const {
      owner,
      participants,
      has_released_result,
      startAt,
      endAt,
      ...details
    } = challenge;
    return {
      ...details,
      startAt: startAt ? startAt.toISOString() : null,
      endAt: endAt.toISOString(),
      hasReleasedResult: challenge.has_released_result,
      participantCount: notCompleted.length + completed.length,
      owner: {
        userId: owner.userId,
        username: owner.username,
        name: owner.name,
        avatar: {
          animal: owner.avatar_animal,
          color: owner.avatar_color,
          background: owner.avatar_bg,
        },
      },
      participants: {
        accepted: {
          completed,
          notCompleted,
        },
        pending,
      },
    };
  }

  async update(
    userId: string,
    challengeId: string,
    updateChallengeDto: UpdateChallengeDto,
  ): Promise<void> {
    const challenge = await this.prisma.challenge.findFirst({
      where: {
        challengeId,
        ownerId: userId,
      },
    });
    if (!challenge) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const { title, description, startAt, endAt, type } = updateChallengeDto;
    const startAtDate: Date | null = startAt
      ? parseJSON(startAt)
      : challenge.startAt;
    const endAtDate: Date | null = endAt ? parseJSON(endAt) : challenge.endAt;
    if (!this.isStartBeforeEnd(startAtDate, endAtDate)) {
      throw new HttpException('Bad reqeust', HttpStatus.BAD_REQUEST);
    }

    const args: Prisma.ChallengeUpdateArgs = {
      where: {
        challengeId,
      },
      data: {
        title: title ?? challenge.title,
        description: description ?? challenge.description,
        startAt: startAtDate,
        endAt: endAtDate,
        type: type ?? challenge.type,
      },
    };

    // TODO: handle participants

    await this.prisma.challenge.update(args);
  }

  async acceptChallenge(userId: string, challengeId: string): Promise<void> {
    await this.prisma.participant.update({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      data: {
        joined_at: new Date(),
      },
    });
  }

  async completeChallenge(userId: string, challengeId: string): Promise<void> {
    await this.prisma.participant.update({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      data: {
        completed_at: new Date(),
      },
    });
  }

  async rejectChallenge(userId: string, challengeId: string): Promise<void> {
    await this.prisma.participant.delete({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });
  }

  async submitProof(
    userId: string,
    challengeId: string,
    submitProofDto: SubmitProofDto,
  ): Promise<void> {
    const challenges = await this.prisma.participant.findMany({
      where: {
        challengeId,
        userId,
        joined_at: { not: null },
      },
    });

    if (challenges.length === 0) {
      return;
    }

    const { data } = submitProofDto; // b64 string
    const uploadResult: UploadApiResponse = await cloudinary.uploader.upload(
      data,
      {
        folder: challengeId,
      },
    );

    if (!uploadResult || !uploadResult.url) {
      throw new Error('Upload failed.');
    }

    await this.prisma.participant.update({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      data: {
        evidence_link: uploadResult.url,
      },
    });
  }

  async deleteProof(userId: string, challengeId: string): Promise<void> {
    const challenges = await this.prisma.participant.findMany({
      where: {
        challengeId,
        userId,
        joined_at: { not: null },
      },
    });

    if (challenges.length === 0) {
      return;
    }

    await this.prisma.participant.update({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      data: {
        evidence_link: null,
      },
    });
  }

  async releaseResults(
    userId: string,
    challengeId: string,
    results: VetoedParticipantsDto,
  ): Promise<void> {
    const { vetoedParticipants } = results;

    const challenge = await this.prisma.challenge.findFirst({
      where: { challengeId },
      select: {
        challengeId: true,
        endAt: true,
        ownerId: true,
      },
    });

    if (!challenge) {
      throw new WsException('Not Found');
    }
    if (!this.isChallengeOver(challenge.endAt)) {
      throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    }

    const participants: string[] = await this.prisma.participant
      .findMany({
        where: {
          challengeId, //  participant instances for this challenge
          userId: { in: vetoedParticipants }, // users that have been vetoed
          joined_at: { not: null }, // have actually joined
          completed_at: { not: null }, // have actually completed
          user: {
            // valid users
            username: { not: null },
            name: { not: null },
            avatar_animal: { not: null },
            avatar_bg: { not: null },
            avatar_color: { not: null },
          },
        },
        select: {
          userId: true,
        },
      })
      .then((result) => result.map((p) => p.userId));

    await this.prisma.$transaction([
      this.prisma.challenge.update({
        where: {
          challengeId,
        },
        data: {
          has_released_result: true,
        },
      }),
      this.prisma.participant.updateMany({
        where: {
          challengeId,
          userId: { in: participants },
        },
        data: {
          has_been_vetoed: true,
        },
      }),
    ]);
  }

  async submitVote(
    userId: string,
    challengeId: string,
    voteData: SubmitVoteDto,
  ): Promise<void> {
    const participant = await this.prisma.participant.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });
    if (!participant) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const { victimId } = voteData;
    const victim = await this.prisma.participant.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId: victimId,
        },
      },
    });
    if (!victim) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    // await this.prisma.participant.update({
    //   where: {
    //     challengeId_userId: {
    //       challengeId,
    //       userId: victimId,
    //     },
    //   },
    //   data: {
    //     has_been_vetoed: true,
    //   },
    // });
  }

  async getVotes(userId: string, challengeId: string): Promise<VoteData[]> {
    const participant = await this.prisma.participant.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });
    if (!participant) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const challenge = await this.prisma.challenge.findUnique({
      where: { challengeId },
      include: {
        votes: {
          select: {
            victimId: true,
            accuserId: true,
          },
        },
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    const countMap: Map<string, string[]> = this.countAccusers(challenge.votes);
    const result: VoteData[] = challenge.participants
      .filter((p) => p.joined_at)
      .map((p) => ({
        victim: {
          userId: p.userId,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          username: p.user.username!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          name: p.user.name!,
          evidenceLink: p.evidence_link ?? undefined,
        },
        accusers: countMap.get(p.userId) ?? [],
      }));

    return result;
  }
}
