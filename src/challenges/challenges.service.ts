import { ChallengeInviteType, Prisma } from '.prisma/client';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isBefore, parseJSON } from 'date-fns';
import { orderBy } from 'lodash';
import { PrismaService } from '../prisma.service';
import { SubmitProofDto } from '../proofs/dto/submit-proof.dto';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import {
  ChallengeData,
  ChallengeList,
  PublicChallengeList,
  ShamedList,
  UserMini,
} from './entities/challenge.entity';
import { VetoedParticipantsDto } from './dto/vetoed-participants.dto';
import { WsException } from '@nestjs/websockets';
import { SubmitVoteDto } from '../votes/dto/submit-vote.dto';
import { VoteData } from '../votes/votes.entities';
import { Challenge, Participant, User } from '@prisma/client';
import { CHALLENGE_COMPLETION_AWARD } from 'src/store/store.entity';

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
  private hasChallengeEnded(end: Date): boolean {
    return !isBefore(new Date(), end);
  }

  // checks if the challenge has started
  private hasChallengeStarted(start: Date | null): boolean {
    if (!start) {
      return false;
    }
    return isBefore(start, new Date());
  }

  private formatChallenge(
    c: Challenge & {
      participants: (Participant & {
        user: User;
      })[];
      owner: User;
    },
  ): ChallengeData {
    const { owner, participants } = c;

    const accepted: UserMini[] = [];
    const pending: UserMini[] = [];
    const notCompleted: UserMini[] = [];
    const completed: UserMini[] = [];

    // for this challenge, organise it into accepted and pending users
    for (const participant of participants) {
      const { userId, username, name, avatar_animal, avatar_bg, avatar_color } =
        participant.user;
      if (participant.joined_at === null) {
        /* eslint-disable @typescript-eslint/no-non-null-assertion,no-inner-declarations */
        // allow for !. in this block => assume that username, name, avatars are all present
        // see  `POST challenges/`, `PATCH challenges/:challengeId`, `POST challenges/accept`,
        // these are the endpoints that insert rows into participants, and they check for these fields to exist
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
      inviteType: c.invite_type,
      hasReleasedResult: !!c.result_released_at,
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
    /* eslint-enable @typescript-eslint/no-non-null-assertion,no-inner-declarations */
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
          username: { not: null },
          name: { not: null },
          avatar_animal: { not: null },
          avatar_bg: { not: null },
          avatar_color: { not: null },
        },
        select: {
          userId: true,
        },
      });

    const pUserIds = qUserIds.filter((p) => p.userId !== userId);
    pUserIds.push({ userId, joined_at: new Date() });

    const {
      title,
      description,
      startAt,
      endAt,
      type,
      inviteType = ChallengeInviteType.PRIVATE,
    } = createChallengeDto;
    await this.prisma.challenge.create({
      data: {
        title,
        description,
        startAt,
        endAt,
        type,
        invite_type: inviteType,
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

  async getUserChallenges(userId: string): Promise<ChallengeList> {
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

    const ongoing: ChallengeData[] = [];
    const pendingStart: ChallengeData[] = [];
    const pendingResponse: ChallengeData[] = [];
    const history: ChallengeData[] = [];

    for (const participantOf of participatingInstances) {
      const c: ChallengeData = this.formatChallenge(participantOf.challenge);

      if (
        this.hasChallengeEnded(participantOf.challenge.endAt) &&
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

    // TODO: see if the interface needs to be changed since client can organise it

    const sortedHistory: ChallengeData[] = orderBy(history, ['endAt'], 'desc');
    return {
      ongoing,
      pendingStart,
      pendingResponse,
      history: sortedHistory,
    };
  }

  async getPublicChallenges(userId: string): Promise<PublicChallengeList> {
    const rawPublicChallenges = await this.prisma.challenge.findMany({
      where: {
        invite_type: ChallengeInviteType.PUBLIC,
        startAt: { gte: new Date() },
        endAt: { gt: new Date() },
      },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
        owner: true,
      },
    });

    const publicChallenges = rawPublicChallenges.map(this.formatChallenge);
    const publicChallengesSorted = orderBy(
      publicChallenges,
      [(c) => c.participantCount, (c) => c.title],
      ['desc', 'asc'],
    );

    const featured: ChallengeData[] = [];
    const others: ChallengeData[] = [];

    for (let i = 0; i < publicChallengesSorted.length; i++) {
      const c = publicChallengesSorted[i];
      if (i < 5) {
        featured.push(c);
      } else {
        others.push(c);
      }
    }

    return { featured, others };
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
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const data: ChallengeData = this.formatChallenge(challenge);
    return data;
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
      include: {
        participants: true,
      },
    });
    if (!challenge) {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }

    const { title, description, startAt, endAt, type } = updateChallengeDto;
    const startAtDate: Date | null = startAt
      ? parseJSON(startAt)
      : challenge.startAt;
    const endAtDate: Date | null = endAt ? parseJSON(endAt) : challenge.endAt;
    if (!this.isStartBeforeEnd(startAtDate, endAtDate)) {
      throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
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

    if (updateChallengeDto.participants) {
      const { participants: reqParticipants } = updateChallengeDto;
      const participants = await this.prisma.user.findMany({
        where: {
          userId: {
            in: reqParticipants,
            not: userId, // ensure owner is untouched
          },
          // ensure not initiated users cannot be added as participants
          username: { not: null },
          name: { not: null },
          avatar_animal: { not: null },
          avatar_color: { not: null },
          avatar_bg: { not: null },
        },
        select: {
          userId: true,
          fb_reg_token: true,
          cfg_invites_notif: true,
        },
      });

      const newParticipants = participants.filter(
        (p) => !challenge.participants.find((e) => e.userId === p.userId),
      );
      const removedParticipants = challenge.participants.filter(
        (e) =>
          e.userId !== challenge.ownerId &&
          !participants.find((p) => p.userId === e.userId),
      );

      args.data['participants'] = {
        createMany: {
          data: newParticipants.map((p) => ({ userId: p.userId })),
        },
        deleteMany: {
          userId: { in: removedParticipants.map((p) => p.userId) },
        },
      };
    }

    await this.prisma.challenge.update(args);
  }

  async acceptChallenge(userId: string, challengeId: string): Promise<void> {
    try {
      // accept only valid users
      await this.prisma.user.findFirst({
        where: {
          userId,
          username: { not: null },
          name: { not: null },
          avatar_animal: { not: null },
          avatar_bg: { not: null },
          avatar_color: { not: null },
        },
      });
    } catch (error) {
      console.log('TODO: update the error handling path');
      throw new HttpException(
        'User not found/properly initialised',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
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
    } catch (error) {
      const metaFields = this.prisma.customGetMetaFields(error);
      console.log(error); // TODO: use the correct error instead of catchall
      await this.prisma.participant.create({
        data: {
          challengeId,
          userId,
          joined_at: new Date(),
        },
      });
    }
  }

  async completeChallenge(
    userId: string,
    challengeId: string,
    opType: 'http' | 'ws' = 'http',
  ): Promise<void> {
    const participant = await this.prisma.participant.findUnique({
      where: {
        challengeId_userId: { userId, challengeId },
      },
      include: {
        challenge: true,
      },
    });

    if (!participant) {
      if (opType === 'http') {
        throw new HttpException(
          'Challenge and/or user not found',
          HttpStatus.NOT_FOUND,
        );
      } else if (opType === 'ws') {
        throw new WsException('Challenge and/or user not found');
      }
    }

    if (participant.completed_at || participant.has_been_vetoed) {
      if (opType === 'http') {
        throw new HttpException(
          'User has already completed the challenge or has been vetoed',
          HttpStatus.BAD_REQUEST,
        );
      } else if (opType === 'ws') {
        throw new WsException(
          'User has already completed the challenge or has been vetoed',
        );
      }
    }

    if (
      !this.hasChallengeStarted(participant.challenge.startAt) ||
      this.hasChallengeEnded(participant.challenge.endAt)
    ) {
      if (opType === 'http') {
        throw new HttpException(
          'Invalid challenge state',
          HttpStatus.BAD_REQUEST,
        );
      } else if (opType === 'ws') {
        throw new WsException('Invalid challenge state');
      }
    }

    try {
      const reward = CHALLENGE_COMPLETION_AWARD;

      await this.prisma.$transaction([
        this.prisma.participant.update({
          where: {
            challengeId_userId: {
              challengeId,
              userId,
            },
          },
          data: {
            completed_at: new Date(),
          },
        }),
        this.prisma.user.update({
          where: {
            userId,
          },
          data: {
            points: { increment: reward },
          },
        }),
      ]);
    } catch (error) {
      if (opType === 'http') {
        // allow for 500 here, unknown error
        throw new HttpException(
          'Operation failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else if (opType === 'ws') {
        throw new WsException('Operation failed');
      }
    }
  }

  async rejectChallenge(
    userId: string,
    challengeId: string,
    opType: 'http' | 'ws' = 'http',
  ): Promise<void> {
    const participant = await this.prisma.participant.findUnique({
      where: {
        challengeId_userId: { challengeId, userId },
      },
      include: {
        challenge: true,
      },
    });
    if (!participant) {
      if (opType === 'http') {
        throw new HttpException(
          'Challenge and/or user not found',
          HttpStatus.NOT_FOUND,
        );
      } else if (opType === 'ws') {
        throw new WsException('Challenge and/or user not found');
      }
    }

    if (participant.completed_at || participant.has_been_vetoed) {
      if (opType === 'http') {
        throw new HttpException(
          'User has already completed the challenge or has been vetoed',
          HttpStatus.BAD_REQUEST,
        );
      } else if (opType === 'ws') {
        throw new WsException(
          'User has already completed the challenge or has been vetoed',
        );
      }
    }

    if (
      this.hasChallengeStarted(participant.challenge.startAt) ||
      this.hasChallengeEnded(participant.challenge.endAt)
    ) {
      if (opType === 'http') {
        throw new HttpException(
          'Invalid challenge state',
          HttpStatus.BAD_REQUEST,
        );
      } else if (opType === 'ws') {
        throw new WsException('Invalid challenge state');
      }
    }

    try {
      await this.prisma.participant.delete({
        where: {
          challengeId_userId: {
            challengeId,
            userId,
          },
        },
      });
    } catch (error) {
      if (opType === 'http') {
        // allow for 500 here, unknown error
        throw new HttpException(
          'Operation failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else if (opType === 'ws') {
        throw new WsException('Operation failed');
      }
    }
  }

  async submitProof(
    userId: string,
    challengeId: string,
    submitProofDto: SubmitProofDto,
  ): Promise<void> {
    try {
      await this.prisma.participant.findFirst({
        where: {
          challengeId,
          userId,
          joined_at: { not: null },
        },
      });
    } catch (error) {
      throw new HttpException(
        'Challenge and/or user not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const { data } = submitProofDto; // b64 string
    const uploadResult: UploadApiResponse = await cloudinary.uploader.upload(
      data,
      {
        folder: challengeId,
      },
    );

    if (!uploadResult || !uploadResult.url) {
      // cloudinary error
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      await this.prisma.participant.update({
        where: {
          challengeId_userId: {
            challengeId,
            userId,
          },
        },
        data: {
          // completed_at: new Date(), // based on new workflow
          evidence_link: uploadResult.url,
        },
      });
    } catch (error) {
      // should not happen based on the previous check error
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteProof(userId: string, challengeId: string): Promise<void> {
    try {
      await this.prisma.participant.findFirst({
        where: {
          challengeId,
          userId,
          joined_at: { not: null },
        },
      });
    } catch (error) {
      throw new HttpException(
        'Challenge and/or user not found',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
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
    } catch (error) {
      // should not happen based on the previous check error
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async releaseResults(
    userId: string,
    challengeId: string,
    results: VetoedParticipantsDto,
    opType: 'ws' | 'http' = 'http',
  ): Promise<void> {
    const { vetoedParticipants } = results;

    const challenge = await this.prisma.challenge.findFirst({
      where: {
        challengeId,
        ownerId: userId,
      },
      select: {
        challengeId: true,
        endAt: true,
        ownerId: true,
      },
    });

    if (!challenge) {
      if (opType === 'ws') {
        throw new WsException('Not found');
      } else if (opType === 'http') {
        throw new HttpException('Not found', HttpStatus.NOT_FOUND);
      }
    }
    if (!this.hasChallengeEnded(challenge.endAt)) {
      if (opType === 'ws') {
        throw new WsException('Bad request');
      } else if (opType === 'http') {
        throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      }
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
          result_released_at: new Date(),
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
    accuserId: string,
    challengeId: string,
    voteData: SubmitVoteDto,
  ): Promise<void> {
    const { victimId } = voteData;
    const doTheyExist = await this.prisma.participant
      .count({
        where: {
          challengeId,
          OR: [{ userId: accuserId }, { userId: victimId }],
        },
      })
      .then((count) => count === 2);
    if (!doTheyExist) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const challenge = await this.prisma.challenge.findFirst({
      where: { challengeId },
      select: { endAt: true },
    });
    if (!challenge || !this.hasChallengeEnded(challenge.endAt)) {
      throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    }

    try {
      const existingVote = await this.prisma.vote.findUnique({
        where: {
          challengeId_victimId_accuserId: {
            challengeId,
            victimId,
            accuserId,
          },
        },
      });

      if (existingVote) {
        return;
      } else {
        await this.prisma.vote.create({
          data: {
            victimId,
            accuserId,
            challengeId,
          },
        });
        return;
      }
    } catch (error) {
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getVotes(userId: string, challengeId: string): Promise<VoteData[]> {
    const participant = await this.prisma.participant.findFirst({
      where: {
        challengeId,
        userId,
        joined_at: { not: null },
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
        // allow for ! here due to the challenges create/update logic
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

  async getShameList(): Promise<ShamedList[]> {
    const raw = await this.prisma.participant.findMany({
      where: {
        challenge: {
          endAt: { lte: new Date() },
          result_released_at: { not: null },
        },
        OR: [{ completed_at: null }, { has_been_vetoed: true }],
      },
      include: {
        challenge: true,
        user: true,
      },
      orderBy: {
        challenge: {
          endAt: 'desc',
        },
      },
      take: 100,
    });

    const result: ShamedList[] = raw.map((p) => ({
      id: `${p.userId}:${p.challengeId}`,
      name: p.user.name,
      title: p.challenge.title,
      type: p.has_been_vetoed ? 'cheat' : 'shame',
      time: p.challenge.result_released_at!.toISOString(), // safe to do so due to the query
      avatar: {
        animal: p.user.avatar_animal,
        color: p.user.avatar_color,
        background: p.user.avatar_bg,
      },
    }));

    console.log(result);
    return result;
  }

  async getShamedListForChallenge(challengeId: string): Promise<ShamedList[]> {
    const raw = await this.prisma.participant.findMany({
      where: {
        challenge: {
          challengeId,
          endAt: { lte: new Date() },
          result_released_at: { not: null },
        },
        OR: [{ completed_at: null }, { has_been_vetoed: true }],
      },
      include: {
        challenge: true,
        user: true,
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    const result: ShamedList[] = raw.map((p) => ({
      id: `${p.userId}:${p.challengeId}`,
      name: p.user.name,
      title: p.challenge.title,
      type: p.has_been_vetoed ? 'cheat' : 'shame',
      time: p.challenge.result_released_at!.toISOString(), // safe to do this due to the query
      avatar: {
        animal: p.user.avatar_animal,
        color: p.user.avatar_color,
        background: p.user.avatar_bg,
      },
    }));

    return result;
  }
}
