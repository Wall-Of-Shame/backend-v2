import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  WebSocketServer,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UsersService } from '../users/users.service';
import { Logger, OnApplicationBootstrap, UseGuards } from '@nestjs/common';
import { JwtWsAuthGuard } from '../auth/jwt-auth-ws.guard';
import { Server, Socket } from 'socket.io';
import { UserList } from '../users/entities/user.entity';
import { ChallengesService } from './challenges.service';
import { UserWsId } from '../auth/user.decorator';
import { ChallengeData, ShamedList } from './entities/challenge.entity';
import { PrismaService } from 'src/prisma.service';
import { CronService } from 'src/cron/cron.service';
import { CronJob } from 'cron';
import { Challenge } from '.prisma/client';
import { add, sub } from 'date-fns';
import { CHALLENGE_COMPLETION_AWARD } from 'src/store/store.entity';

export const EVENTS = {
  connection: 'connection',
  globalLeaderboard: 'globalLeaderboard',
  challengeComplete: 'challengeComplete',
  challengeReject: 'challengeReject',
  challengeAccept: 'challengeAccept',
  challengeReleaseResults: 'challengeReleaseResults',
  roomJoin: 'roomJoin',
  roomLeave: 'roomLeave',
  roomUpdate: 'roomUpdate',
  shameListGet: 'shameListGet',
  shameListUpdate: 'shameListUpdate',
};

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class ChallengeGateway
  implements OnGatewayConnection, OnApplicationBootstrap
{
  JOB_RELEASE_RESULTS = 'release-results';
  JOB_RELEASE_REWARDS = 'release-rewards';

  constructor(
    private prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly challengesService: ChallengesService,
    private readonly cronService: CronService,
  ) {}

  private readonly wsLogger = new Logger(ChallengeGateway.name);

  @WebSocketServer()
  server: Server;

  async handleConnection(socket: Socket) {
    const event = EVENTS.connection;
    socket.emit(event, { clientId: socket.id }); // success message
    this.wsLogger.log(`Socket ${socket.id}: CONNECTED`);
  }

  async onApplicationBootstrap() {
    const now = new Date();
    const rewardTime = sub(now, { hours: 1 });

    const futureChallenges = await this.prisma.challenge.findMany({
      where: { endAt: { gte: now } },
    });
    futureChallenges.forEach((c) => this.addCronJob(c));

    const challengesPendingRewards = await this.prisma.challenge.findMany({
      where: {
        // endAt <= now <= endAt + 1hr
        endAt: {
          lte: now,
          gte: rewardTime,
        },
      },
    });
    challengesPendingRewards.forEach((c) => this.cronReleaseRewards(c));

    this.cronService.logStats();
  }

  addCronJob(c: Challenge): void {
    this.cronReleaseResults(c);
    this.cronReleaseRewards(c);
  }

  private cronReleaseResults(c: Challenge): void {
    this.cronService.addCronJob(
      `${c.challengeId}-${this.JOB_RELEASE_RESULTS}`,
      new CronJob(c.endAt, () => {
        this.wsLogger.log(`Auto releasing results for ${c.challengeId}`);
        this.prisma.challenge
          .update({
            where: { challengeId: c.challengeId },
            data: {
              result_released_at: c.endAt,
            },
          })
          .then((_) => {
            this.wsLogger.log(`Notifying everyone on ${c.challengeId}`);
            this.releaseResultsNotify(c.challengeId);
          });
      }),
    );
  }

  private cronReleaseRewards(c: Challenge): void {
    const reward = CHALLENGE_COMPLETION_AWARD;
    const now = new Date();

    this.cronService.addCronJob(
      `${c.challengeId}-${this.JOB_RELEASE_REWARDS}`,
      new CronJob(add(c.endAt, { minutes: 60, seconds: 5 }), () => {
        this.wsLogger.log(`Rewards distribution for ${c.challengeId}`);
        this.prisma.participant
          .findMany({
            where: {
              challengeId: c.challengeId,
              completed_at: { not: null },
              has_been_vetoed: false,
            },
          })
          .then(async (participants) => {
            const completedUsers = participants.map((p) => p.userId);
            // TOOD: N+1 query here
            const rewardedUsers = (
              await Promise.all(
                completedUsers.map(async (userId) => {
                  const limit = await this.challengesService.getPointLimit(
                    userId,
                    now,
                  );
                  return limit.pointsLeft > 0 ? userId : null;
                }),
              )
            ).filter(Boolean);

            await this.prisma.$transaction([
              this.prisma.user.updateMany({
                where: { userId: { in: rewardedUsers } },
                data: {
                  points: { increment: reward },
                },
              }),
              this.prisma.challenge.update({
                where: { challengeId: c.challengeId },
                data: { rewards_released_at: now },
              }),
            ]);
            return rewardedUsers;
          })
          .then((users) => {
            this.wsLogger.log(`Rewarded ${users.length} for ${c.challengeId}`);
          });
      }),
    );
  }

  editCronJob(c: Challenge): void {
    // TODO: refactor this to share logic between addCronJob and editCronJob
    this.cronService.changeCronJobDate(
      `${c.challengeId}-${this.JOB_RELEASE_RESULTS}`,
      c.endAt,
    );
    this.cronService.changeCronJobDate(
      `${c.challengeId}-${this.JOB_RELEASE_REWARDS}`,
      add(c.endAt, { minutes: 60, seconds: 5 }),
    );
  }

  /**
   * Handles the globalLeaderboard event.
   *
   * Expecting:
   *
   * ```
   * { } // ie nothing
   * ```
   *
   * Returns:
   *  EMITS:
   *    ON globalLeaderboard event :: TYPE UserList[]
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.globalLeaderboard)
  async getGlobalLeaderboard(@ConnectedSocket() socket: Socket) {
    const event = EVENTS.globalLeaderboard;
    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);

    try {
      const results: UserList[] =
        await this.usersService.getGlobalLeaderboard();

      socket.emit(event, results);
      this.wsLogger.log(
        `Socket ${socket.id}: Emited ${event} with payload of ${results.length} size`,
      );
    } catch (error) {
      console.log(error);
      throw new WsException(`Failed to emit ${event}`);
    }
  }

  /**
   * Handles the roomJoin event.
   *
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   * }
   * ```
   *
   * Returns:
   *  EMITS:
   *    ON roomUpdate :: TYPE ChallengeData
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.roomJoin)
  async joinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody('challengeId') challengeId: string,
  ) {
    const event = EVENTS.roomJoin;
    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);

    try {
      if (challengeId) {
        socket.join(challengeId);
        await this.challengeUpdateNotify(challengeId);
        this.wsLogger.log(`Socket ${socket.id}: Emited ${event}`);
      }
    } catch (error) {
      console.log(error);
      throw new WsException('ChallengeId not found');
    }
  }

  /**
   * Handles the roomLeave event.
   *
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   * }
   * ```
   *
   * Returns:
   *  ACK:
   *    TYPE { roomId: string }
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.roomLeave)
  async leaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody('challengeId') challengeId: string,
  ) {
    const event = EVENTS.roomLeave;
    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);

    try {
      if (challengeId) {
        socket.leave(challengeId);
        this.wsLogger.log(`Socket ${socket.id}: Emited ${event}`);
        return { roomId: challengeId };
      }
    } catch (error) {
      console.log(error);
      // do nothing
    }
  }

  /**
   * Handles the challengeAccept event.
   *
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   * }
   * ```
   *
   * Returns:
   *  EMITS:
   *    ON roomUpdate :: TYPE ChallengeData
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeAccept)
  async acceptChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    const event = EVENTS.challengeAccept;
    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);

    try {
      await this.challengesService.acceptChallenge(userId, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Acceptance of challenge failed');
    }

    try {
      // TODO: refactor as this is same code as join room
      socket.join(challengeId);
      await this.challengeUpdateNotify(challengeId);
      this.wsLogger.log(`Socket ${socket.id}: Emited ${event}`);
    } catch (error) {
      console.log(error);
      throw new WsException('Failed to join room');
    }
  }

  /**
   * Handles the challengeReject event.
   *
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   * }
   * ```
   *
   * Returns:
   *  ACK:
   *    TYPE { roomId: string }
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeReject)
  async rejectChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    const event = EVENTS.challengeReject;
    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);

    try {
      await this.challengesService.rejectChallenge(userId, challengeId);
      socket.leave(challengeId);

      this.wsLogger.log(`Socket ${socket.id}: Emitted ${event}`);
      return { roomId: challengeId };
    } catch (error) {
      console.log(error);
      throw new WsException('Rejection of challenge failed');
    }
  }

  /**
   * Handles the challengeComplete event.
   *
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   * }
   * ```
   *
   * Returns:
   *  EMITS:
   *    ON roomUpdate :: TYPE ChallengeData
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeComplete)
  async completeChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    const event = EVENTS.challengeComplete;
    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);

    try {
      await this.challengesService.completeChallenge(userId, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Completion of challenge failed');
    }

    try {
      await this.challengeUpdateNotify(challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Failed to notify room');
    }
  }

  /**
   * Deprecate due to change in user flow.
   * Handles the challengeReleaseResults event.
   * => Informs all sockets of new leaderboard
   * => Informs all sockets of new live update

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeReleaseResults)
  async releaseChallengeResults(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
    @MessageBody('data') data: VetoedParticipantsDto,
  ) {
    const event = EVENTS.challengeReleaseResults;

    this.wsLogger.log(socket, event, 'RECEIVE');
    await this.challengesService.releaseResults(
      userId,
      challengeId,
      data,
      'ws',
    );

    await this.releaseResultsNotify(this.server, challengeId);
  }
    */

  /**
   * Handles the shameListGet event.
   * For the live updating of the wos.
   *
   * Expecting:
   *
   * ```
   * { } // ie nothing
   * ```
   *
   * Returns:
   *  EMITS:
   *    ON shameListGet event :: TYPE ShamedList[]
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.shameListGet)
  async getShameList(@ConnectedSocket() socket: Socket) {
    const event = EVENTS.shameListGet;

    this.wsLogger.log(`Socket ${socket.id}: Received ${event}`);
    const result: ShamedList[] = await this.challengesService.getShameList();

    this.wsLogger.log(
      `Socket ${socket.id}: Emitted ${event} with ${result.length} ShameList entries.`,
    );
    return result;
  }

  async notifyCheater(victimId: string, challengeId: string) {
    const cheater = await this.challengesService.getShame(
      victimId,
      challengeId,
    );
    if (!cheater) {
      return;
    }

    this.server.emit(EVENTS.shameListUpdate, [cheater]);
    this.wsLogger.log(
      `Emitting cheater ${victimId} through ${EVENTS.shameListUpdate}`,
    );
  }

  private async releaseResultsNotify(challengeId: string): Promise<void> {
    await this.emitNewGlobalWall(EVENTS.globalLeaderboard);
    await this.emitNewShamedListEntries(challengeId, EVENTS.shameListUpdate);
  }

  async challengeUpdateNotify(challengeId: string): Promise<void> {
    try {
      if (!challengeId) {
        return;
      }

      const data: ChallengeData = await this.challengesService.findOne(
        challengeId,
      );
      this.server.in(challengeId).emit(EVENTS.roomUpdate, data);
    } catch (error) {
      console.log(error);
      throw new WsException('Failed to emit roomUpdate');
    }
  }

  private async emitNewGlobalWall(event: string): Promise<void> {
    const results = await this.usersService.getGlobalLeaderboard();
    this.server.emit(event, results);
    this.wsLogger.log(
      `Emitted ${event} toa all sockets with ${results.length} UserList entries`,
    );
  }

  private async emitNewShamedListEntries(
    challengeId: string,
    event: string,
  ): Promise<void> {
    const results: ShamedList[] =
      await this.challengesService.getShamedListForChallenge(challengeId);
    this.server.emit(event, results);
    this.wsLogger.log(
      `Emitted ${event} toa all sockets with ${results.length} ShamedList entries`,
    );
  }
}
