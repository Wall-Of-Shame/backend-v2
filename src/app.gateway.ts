import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  WebSocketServer,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UsersService } from './users/users.service';
import { UseGuards } from '@nestjs/common';
import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';
import { Server, Socket } from 'socket.io';
import { UserList } from './users/entities/user.entity';
import { ChallengesService } from './challenges/challenges.service';
import { UserWsId } from './auth/user.decorator';
import { VetoedParticipantsDto } from './challenges/dto/vetoed-participants.dto';
import { WsLogger } from './middleware/ws-logger.middleware';
import { AppEmitter } from './app.emitter';
import { ChallengeData } from './challenges/entities/challenge.entity';

export const EVENTS = {
  connection: 'connection',
  globalLeaderboard: 'globalLeaderboard',
  challengeComplete: 'challengeComplete',
  challengeReject: 'challengeReject',
  challengeAccept: 'challengeAccept',
  challengeReleaseResults: 'challengeReleaseResults',
  roomJoin: 'roomJoin',
  roomLeave: 'roomLeave',
};

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class AppGateway implements OnGatewayConnection {
  constructor(
    private readonly usersService: UsersService,
    private readonly challengesService: ChallengesService,
    private readonly appEmitter: AppEmitter,
  ) {}

  private readonly wsLogger = new WsLogger();

  @WebSocketServer()
  server: Server;

  async handleConnection(socket: Socket) {
    socket.emit(EVENTS.connection, { clientId: socket.id }); // success message
    this.wsLogger.log(socket, EVENTS.connection, 'EMIT');
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
   *  ACK:
   *    <NONE>
   *  EMITS:
   *    ON globalLeaderboard event :: TYPE UserList[]
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.globalLeaderboard)
  async getGlobalLeaderboard(@ConnectedSocket() socket: Socket) {
    this.wsLogger.log(socket, EVENTS.globalLeaderboard, 'RECEIVE');
    const results: UserList[] = await this.usersService.getGlobalLeaderboard();
    socket.emit(EVENTS.globalLeaderboard, results);
    this.wsLogger.log(socket, EVENTS.globalLeaderboard, 'EMIT');
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
   *  ACK:
   *    TYPE ChallengeData
   *  EMITS:
   *    TODO
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.roomJoin)
  async joinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody('challengeId') challengeId: string,
  ) {
    this.wsLogger.log(socket, EVENTS.roomJoin, 'RECEIVE');
    if (challengeId) {
      try {
        const challengeData: ChallengeData =
          await this.challengesService.findOne(challengeId);

        socket.join(challengeId);

        // TODO: broadcast

        this.wsLogger.log(socket, EVENTS.roomJoin, 'EMIT');
        return challengeData;
      } catch (e) {
        console.log(e);
        throw new WsException('ChallengeId not found');
      }
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
   *  EMITS:
   *    TODO
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.roomLeave)
  async leaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody('challengeId') challengeId: string,
  ) {
    this.wsLogger.log(socket, EVENTS.roomLeave, 'RECEIVE');
    if (challengeId) {
      try {
        socket.leave(challengeId);

        // TODO: broadcast

        this.wsLogger.log(socket, EVENTS.roomLeave, 'EMIT');
        return { roomId: challengeId };
      } catch (e) {
        console.log(e);
        // do nothing
      }
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
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeAccept)
  async acceptChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    this.wsLogger.log(socket, EVENTS.challengeAccept, 'RECEIVE');

    try {
      await this.challengesService.acceptChallenge(userId, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Acceptance of challenge failed');
    }

    try {
      // TODO: refactor as this is same code as join room
      const challengeData: ChallengeData = await this.challengesService.findOne(
        challengeId,
      );

      socket.join(challengeId);

      // TODO: broadcast

      this.wsLogger.log(socket, EVENTS.roomJoin, 'EMIT');
      return challengeData;
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
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeReject)
  async rejectChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    this.wsLogger.log(socket, EVENTS.challengeReject, 'RECEIVE');

    try {
      await this.challengesService.rejectChallenge(userId, challengeId);
      socket.leave(challengeId);

      this.wsLogger.log(socket, EVENTS.challengeReject, 'EMIT');
      return { roomId: challengeId };
    } catch (error) {
      console.log(error);
      throw new WsException('Rejection of challenge failed');
    }
  }

  /**
   * Expecting:
   *
   * ```
   * {
   *  challengeId: string,
   * }
   * ```
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeComplete)
  async completeChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    this.wsLogger.log(socket, EVENTS.challengeComplete, 'RECEIVE');

    try {
      await this.challengesService.completeChallenge(userId, challengeId);
    } catch (error) {
      console.log(error);
      throw new WsException('Completion of challenge failed');
    }

    try {
      // TODO: broadcast
    } catch (error) {
      console.log(error);
      throw new WsException('Failed to notify room');
    }
  }

  /**
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
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.challengeReleaseResults)
  async releaseChallengeResults(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
    @MessageBody('data') data: VetoedParticipantsDto,
  ) {
    this.wsLogger.log(socket, EVENTS.challengeReleaseResults, 'RECEIVE');
    await this.challengesService.releaseResults(
      userId,
      challengeId,
      data,
      'ws',
    );

    await this.appEmitter.releaseResultsNotify(
      this.server,
      challengeId,
      EVENTS.challengeReleaseResults,
    );
  }
}
