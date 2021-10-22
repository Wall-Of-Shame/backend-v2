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
import { VetoedParticipantsDto } from './dto/vetoed-participants.dto';
import { WsLogger } from '../middleware/ws-logger.middleware';
import { ChallengeData, ShamedList } from './entities/challenge.entity';
import { PrismaService } from 'src/prisma.service';
import { CronService } from 'src/cron/cron.service';
import { CronJob } from 'cron';
import { Challenge } from '.prisma/client';

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
    this.wsLogger.log(socket, event, 'EMIT');
  }

  async onApplicationBootstrap() {
    await this.initJobs();
  }

  async initJobs(): Promise<void> {
    const challenges = await this.prisma.challenge.findMany({
      where: { endAt: { gte: new Date() } },
    });

    challenges.forEach(this.addCronJob);

    this.cronService.logStats();
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
    this.wsLogger.log(socket, event, 'RECEIVE');

    try {
      const results: UserList[] =
        await this.usersService.getGlobalLeaderboard();

      socket.emit(event, results);
      this.wsLogger.log(socket, event, 'EMIT');
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
    this.wsLogger.log(socket, event, 'RECEIVE');

    try {
      if (challengeId) {
        socket.join(challengeId);
        await this.challengeUpdateNotify(this.server, challengeId);
        this.wsLogger.log(socket, event, 'EMIT');
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
    this.wsLogger.log(socket, event, 'RECEIVE');

    try {
      if (challengeId) {
        socket.leave(challengeId);
        this.wsLogger.log(socket, event, 'EMIT');
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
    this.wsLogger.log(socket, event, 'RECEIVE');

    try {
      await this.challengesService.acceptChallenge(userId, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Acceptance of challenge failed');
    }

    try {
      // TODO: refactor as this is same code as join room
      socket.join(challengeId);
      await this.challengeUpdateNotify(this.server, challengeId);
      this.wsLogger.log(socket, event, 'EMIT');
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
    this.wsLogger.log(socket, event, 'RECEIVE');

    try {
      await this.challengesService.rejectChallenge(userId, challengeId);
      socket.leave(challengeId);

      this.wsLogger.log(socket, event, 'EMIT');
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
    this.wsLogger.log(socket, event, 'RECEIVE');

    try {
      await this.challengesService.completeChallenge(userId, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Completion of challenge failed');
    }

    try {
      await this.challengeUpdateNotify(this.server, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Failed to notify room');
    }
  }

  /**
   * Handles the challengeReleaseResults event.
   * => Informs all sockets of new leaderboard
   * => Informs all sockets of new live update
   *
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   *  data: {
   *    vetoedParticipants: string[]
   *  }
   * }
   * ```
   *
   * Returns:
   *  EMITS:
   *    ON challengeReleaseResults :: TYPE UserList[]
   */
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

    this.wsLogger.log(socket, event, 'RECEIVE');
    const result: ShamedList[] = await this.challengesService.getShameList();

    this.wsLogger.log(socket, event, 'EMIT');
    return result;
  }

  private addCronJob(c: Challenge): void {
    this.cronService.addCronJob(
      c.challengeId,
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
            this.releaseResultsNotify(this.server, c.challengeId);
          });
      }),
    );
  }

  private async releaseResultsNotify(
    server: Server,
    challengeId: string,
  ): Promise<void> {
    await this.emitNewGlobalWall(server, EVENTS.globalLeaderboard);
    await this.emitNewShamedListEntries(
      server,
      challengeId,
      EVENTS.shameListUpdate,
    );
  }

  private async challengeUpdateNotify(
    server: Server,
    challengeId: string,
  ): Promise<void> {
    try {
      if (!challengeId) {
        return;
      }

      const data: ChallengeData = await this.challengesService.findOne(
        challengeId,
      );
      server.in(challengeId).emit(EVENTS.roomUpdate, data);
    } catch (error) {
      console.log(error);
      throw new WsException('Failed to emit roomUpdate');
    }
  }

  private async emitNewGlobalWall(
    server: Server,
    event: string,
  ): Promise<void> {
    const results = await this.usersService.getGlobalLeaderboard();
    server.emit(event, results);
    console.log('SOCKET: -<GLOBAL>- || EVENT: ' + event);
  }

  private async emitNewShamedListEntries(
    server: Server,
    challengeId: string,
    event: string,
  ): Promise<void> {
    const results: ShamedList[] =
      await this.challengesService.getShamedListForChallenge(challengeId);
    server.emit(event, results);
    console.log('SOCKET: -<GLOBAL>- || EVENT: ' + event);
  }
}
