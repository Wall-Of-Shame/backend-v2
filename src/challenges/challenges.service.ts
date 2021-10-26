import { ChallengeInviteType, Prisma } from '.prisma/client';
import { Global, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isAfter, isBefore, parseJSON } from 'date-fns';
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
import { intervalToDuration, add } from 'date-fns';

@Global()
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

  private isInVotingState(endAt: Date, now: Date): boolean {
    const endOfVotingPeriod = add(endAt, { minutes: 60 });
    if (isBefore(endAt, now) && isBefore(now, endOfVotingPeriod)) {
      return true;
    } else {
      return false;
    }
  }

  private formatChallenge(
    c: Challenge & {
      participants: (Participant & {
        user: User;
        griefed_by: User;
      })[];
      owner: User;
    },
  ): ChallengeData {
    const { owner, participants } = c;

    const accepted: UserMini[] = [];
    const pending: UserMini[] = [];
    const notCompleted: UserMini[] = [];
    const completed: UserMini[] = [];
    const $protected: UserMini[] = [];

    const griefList: string[] = [];

    // for this challenge, organise it into accepted and pending users
    for (const participant of participants) {
      const { userId, username, name, avatar_animal, avatar_bg, avatar_color } =
        participant.user;

      const u: UserMini = {
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
        isProtected: !!participant.applied_protec,
        isGriefed: !!participant.griefed_by_userId,
        griefedBy: participant.griefed_by_userId
          ? {
              userId: participant.griefed_by.userId,
              username: participant.griefed_by.username,
              name: participant.griefed_by.name,
              avatar: {
                animal: participant.griefed_by.avatar_animal,
                background: participant.griefed_by.avatar_bg,
                color: participant.griefed_by.avatar_color,
              },
            }
          : undefined,
      };

      if (participant.griefed_by_userId) {
        griefList.push(participant.userId);
      }

      if (participant.joined_at === null) {
        /* eslint-disable @typescript-eslint/no-non-null-assertion,no-inner-declarations */
        // allow for !. in this block => assume that username, name, avatars are all present
        // see  `POST challenges/`, `PATCH challenges/:challengeId`, `POST challenges/accept`,
        // these are the endpoints that insert rows into participants, and they check for these fields to exist
        pending.push(u);
      } else {
        // user has joined
        if (participant.applied_protec) {
          $protected.push(u);
        } else if (participant.completed_at) {
          // completed
          completed.push(u);
        } else {
          // not completed
          notCompleted.push(u);
        }
      }
    }

    // format the challenge
    return {
      challengeId: c.challengeId,
      title: c.title,
      description: c.description ?? undefined,
      isFeatured: c.is_featured,
      imageURL: c.is_featured ? c.image_url : undefined,
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
        griefList,
        accepted: {
          completed,
          notCompleted,
          protected: $protected,
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
  ): Promise<Challenge> {
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
    const result = await this.prisma.challenge.create({
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

    return result;
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
                griefed_by: true,
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
    const votingPeriod: ChallengeData[] = [];
    const history: ChallengeData[] = [];

    const now = new Date();
    for (const participantOf of participatingInstances) {
      const c: ChallengeData = this.formatChallenge(participantOf.challenge);

      if (
        this.hasChallengeEnded(participantOf.challenge.endAt) &&
        this.hasUserAccepted(participantOf.joined_at)
      ) {
        if (this.isInVotingState(participantOf.challenge.endAt, now)) {
          // votingPeriod
          votingPeriod.push(c);
        } else {
          // history
          history.push(c);
        }
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
      votingPeriod,
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
            griefed_by: true,
          },
        },
        owner: true,
      },
      orderBy: [{ participants: { _count: 'desc' } }, { title: 'desc' }],
    });

    const publicChallenges = rawPublicChallenges.map(this.formatChallenge);

    const featured: ChallengeData[] = [];
    const others: ChallengeData[] = [];

    for (const c of publicChallenges) {
      if (c.isFeatured && c.imageURL) {
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
            griefed_by: true,
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
  ): Promise<Challenge> {
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
      const { participants: reqIds } = updateChallengeDto;
      const reqParticipants = await this.prisma.user.findMany({
        where: {
          userId: {
            in: reqIds,
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

      const newParticipants = reqParticipants.filter(
        (p) => !challenge.participants.find((e) => e.userId === p.userId),
      );

      args.data['participants'] = {
        createMany: {
          data: newParticipants.map((p) => ({ userId: p.userId })),
        },
      };
    }

    const result: Challenge = await this.prisma.challenge.update(args);
    return result;
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

    // TODO: for now, disallow users from leaving once they use protec
    if (participant.griefed_by_userId || participant.applied_protec) {
      if (opType === 'http') {
        throw new HttpException(
          'User cannot reject challenge due to powerup',
          HttpStatus.BAD_REQUEST,
        );
      } else if (opType === 'ws') {
        throw new WsException('User cannot reject challenge due to powerup');
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
          applied_protec: null, // veto only those without protec
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
  ): Promise<string | null> {
    const { victimId } = voteData;
    const userParticipant = await this.prisma.participant
      .findMany({
        where: { challengeId, userId: accuserId, joined_at: { not: null } },
      })
      .then((res) => res[0]);
    if (!userParticipant) {
      throw new HttpException('Participant not found', HttpStatus.NOT_FOUND);
    }

    const victimParticipant = await this.prisma.participant
      .findMany({
        where: {
          challengeId,
          userId: victimId,
          joined_at: { not: null },
        },
      })
      .then((res) => res[0]);
    if (!victimParticipant) {
      throw new HttpException('Victim not found', HttpStatus.NOT_FOUND);
    } else if (victimParticipant.applied_protec) {
      throw new HttpException('Victim applied protec', HttpStatus.BAD_REQUEST);
    }

    const challenge = await this.prisma.challenge.findFirst({
      where: { challengeId },
      select: { endAt: true },
    });
    if (!challenge) {
      throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    }
    if (
      !this.hasChallengeEnded(challenge.endAt) ||
      !this.isInVotingState(challenge.endAt, new Date())
    ) {
      throw new HttpException(
        'Invalid challenge state',
        HttpStatus.BAD_REQUEST,
      );
    }

    console.log(this.isInVotingState(challenge.endAt, new Date()));

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
      throw new HttpException('User has already voted', HttpStatus.BAD_REQUEST);
    }

    const participantCount = await this.prisma.participant.count({
      where: { challengeId, joined_at: { not: null } },
    });

    if (participantCount <= 2) {
      throw new HttpException(
        'No votes allowed for challenges with less than 2 participants',
        HttpStatus.BAD_REQUEST,
      );
    }

    const midPoint = 0.5 * participantCount;
    const currCount = await this.prisma.vote.count({
      where: { challengeId, victimId },
    });

    try {
      if (currCount + 1 >= midPoint && currCount < midPoint) {
        await this.prisma.$transaction([
          this.prisma.vote.create({
            data: {
              victimId,
              accuserId,
              challengeId,
            },
          }),
          this.prisma.participant.update({
            where: {
              challengeId_userId: {
                challengeId,
                userId: victimId,
              },
            },
            data: {
              has_been_vetoed: true,
            },
          }),
        ]);
        return victimId;
      } else {
        await this.prisma.vote.create({
          data: {
            victimId,
            accuserId,
            challengeId,
          },
        });
        return null;
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
          hasProtec: !!p.applied_protec,
          evidenceLink: p.evidence_link ?? undefined,
        },
        accusers: countMap.get(p.userId) ?? [],
      }));

    return result;
  }

  async getShame(
    userId: string,
    challengeId: string,
  ): Promise<ShamedList | null> {
    const p = await this.prisma.participant
      .findMany({
        where: {
          challengeId,
          userId,
          challenge: {
            endAt: { lte: new Date() },
            result_released_at: { not: null },
          },
          applied_protec: null,
          OR: [{ completed_at: null }, { has_been_vetoed: true }],
        },
        include: {
          challenge: true,
          user: true,
        },
      })
      .then((res) => res[0]);

    if (!p) {
      return null;
    }

    const result: ShamedList = {
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
      effect: {
        tomato: p.effect_tomato,
        egg: p.effect_egg,
        poop: p.effect_poop,
      },
    };

    return result;
  }

  async getShameList(): Promise<ShamedList[]> {
    const raw = await this.prisma.participant.findMany({
      where: {
        challenge: {
          endAt: { lte: new Date() },
          result_released_at: { not: null },
        },
        applied_protec: null,
        OR: [{ completed_at: null }, { has_been_vetoed: true }],
      },
      include: {
        challenge: true,
        user: true,
      },
      orderBy: [
        { challenge: { endAt: 'desc' } },
        { user: { name: 'asc' } },
        { challengeId: 'asc' },
      ],
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
      effect: {
        tomato: p.effect_tomato,
        egg: p.effect_egg,
        poop: p.effect_poop,
      },
    }));

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
        applied_protec: null,
        OR: [{ completed_at: null }, { has_been_vetoed: true }],
      },
      include: {
        challenge: true,
        user: true,
      },
      orderBy: [
        { challenge: { endAt: 'desc' } },
        { user: { name: 'asc' } },
        { challengeId: 'asc' },
      ],
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
      effect: {
        tomato: p.effect_tomato,
        egg: p.effect_egg,
        poop: p.effect_poop,
      },
    }));

    return result;
  }

  async useGrief(
    userId: string,
    challengeId: string,
    targetUserId: string,
  ): Promise<void> {
    if (targetUserId === userId) {
      throw new HttpException('Cannot grief self', HttpStatus.BAD_REQUEST);
    }

    const userParticipant:
      | (Participant & {
          user: User;
        })
      | undefined = await this.prisma.participant
      .findMany({
        where: {
          userId,
          challengeId,
          joined_at: { not: null },
        },
        include: {
          user: true,
        },
      })
      .then((res) => res[0]);
    if (!userParticipant || !userParticipant.user) {
      throw new HttpException(
        'No such participant has joined the challenge',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (userParticipant.user.powerup_grief_count < 1) {
      throw new HttpException('No available grief', HttpStatus.BAD_REQUEST);
    }

    const targetUser = await this.prisma.user
      .findMany({
        where: {
          userId: targetUserId,
          // ensure not initiated users cannot be added as participants
          username: { not: null },
          name: { not: null },
          avatar_animal: { not: null },
          avatar_color: { not: null },
          avatar_bg: { not: null },
        },
      })
      .then((res) => res[0]);
    if (!targetUser) {
      throw new HttpException('No such user', HttpStatus.BAD_REQUEST);
    }

    const challenge = await this.prisma.challenge.findUnique({
      where: {
        challengeId,
      },
      include: {
        participants: {
          where: { userId: targetUserId },
        },
      },
    });
    if (!challenge) {
      throw new HttpException('No such challenge', HttpStatus.BAD_REQUEST);
    } else if (
      this.hasChallengeStarted(challenge.startAt) ||
      this.hasChallengeEnded(challenge.endAt)
    ) {
      throw new HttpException(
        'Invalid challenge state',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingParticipant: Participant | undefined =
      challenge.participants.find((p) => p.userId === targetUserId);
    if (existingParticipant && existingParticipant.joined_at) {
      throw new HttpException(
        'Participant already joined',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (existingParticipant) {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { userId },
          data: {
            powerup_grief_count: { decrement: 1 },
          },
        }),
        this.prisma.participant.update({
          where: {
            challengeId_userId: { challengeId, userId: targetUserId },
          },
          data: {
            joined_at: new Date(),
            griefed_by_userId: userId,
          },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { userId },
          data: {
            powerup_grief_count: { decrement: 1 },
          },
        }),
        this.prisma.participant.create({
          data: {
            challengeId,
            userId: targetUserId,
            joined_at: new Date(),
            griefed_by_userId: userId,
          },
        }),
      ]);
    }
  }

  async useProtec(userId: string, challengeId: string): Promise<void> {
    const userParticipant:
      | (Participant & {
          user: User;
        })
      | undefined = await this.prisma.participant
      .findMany({
        where: {
          userId,
          challengeId,
          joined_at: { not: null },
        },
        include: {
          user: true,
        },
      })
      .then((res) => res[0]);
    if (!userParticipant || !userParticipant.user) {
      throw new HttpException(
        'No such participant has joined the challenge',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (userParticipant.user.powerup_protec_count < 1) {
      throw new HttpException('No available protec', HttpStatus.BAD_REQUEST);
    } else if (userParticipant.applied_protec) {
      throw new HttpException(
        'User has already applied protec',
        HttpStatus.BAD_REQUEST,
      );
    }

    const challenge = await this.prisma.challenge.findUnique({
      where: { challengeId },
    });
    if (!challenge) {
      throw new HttpException('No such challenge', HttpStatus.BAD_REQUEST);
    } else if (this.hasChallengeEnded(challenge.endAt)) {
      throw new HttpException(
        'Invalid challenge state',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { userId },
        data: {
          powerup_protec_count: { decrement: 1 },
        },
      }),
      this.prisma.participant.update({
        where: {
          challengeId_userId: { challengeId, userId },
        },
        data: {
          applied_protec: new Date(),
        },
      }),
    ]);
  }

  async searchChallenges(query: string): Promise<ChallengeData[]> {
    if (!query || query === '') {
      return [];
    }

    const raw = await this.prisma.challenge.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
        invite_type: ChallengeInviteType.PUBLIC,
      },
      include: {
        owner: true,
        participants: {
          include: {
            user: true,
            griefed_by: true,
          },
        },
      },
    });

    const result: ChallengeData[] = raw.map(this.formatChallenge);
    return result;
  }
}
