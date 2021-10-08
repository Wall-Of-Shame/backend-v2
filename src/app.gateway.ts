import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';
import { UsersService } from './users/users.service';
import { UseGuards } from '@nestjs/common';
import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';
import { Server, Socket } from 'socket.io';
import { UserList } from './users/entities/user.entity';
import { ChallengesService } from './challenges/challenges.service';
import { UserWsId } from './auth/user.decorator';
import { VetoedParticipantsDto } from './challenges/dto/vetoed-participants.dto';

const EVENTS = {
  connection: 'connection',
  leaderboard: {
    globalLeaderboard: 'globalLeaderboard',
  },
  challengeActions: {
    complete: 'challengeComplete',
    reject: 'challengeReject',
    accept: 'challengeAccept',
    results: 'challengeReleaseResults',
  },
};

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class AppGateway implements OnGatewayConnection {
  constructor(
    private readonly usersService: UsersService,
    private readonly challengesService: ChallengesService,
  ) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    console.log(`Connection established with ${client.id}`);
    client.emit(EVENTS.connection, { clientId: client.id }); // success message
  }

  /**
   * Expecting:
   *
   * ```
   * { } // ie nothing
   * ```
   */
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.leaderboard.globalLeaderboard)
  async getGlobalLeaderboard(@ConnectedSocket() socket: Socket) {
    const results: UserList[] = await this.usersService.getGlobalLeaderboard();
    console.log(results);
    socket.emit(EVENTS.leaderboard.globalLeaderboard, results);
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
  @SubscribeMessage(EVENTS.challengeActions.accept)
  async acceptChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    await this.challengesService.acceptChallenge(userId, challengeId);
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
  @SubscribeMessage(EVENTS.challengeActions.reject)
  async rejectChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    await this.challengesService.rejectChallenge(userId, challengeId);
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
  @SubscribeMessage(EVENTS.challengeActions.complete)
  async completeChallenge(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
  ) {
    await this.challengesService.completeChallenge(userId, challengeId);
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
  @SubscribeMessage(EVENTS.challengeActions.results)
  async releaseChallengeResults(
    @ConnectedSocket() socket: Socket,
    @UserWsId() userId: string,
    @MessageBody('challengeId') challengeId: string,
    @MessageBody('data') data: VetoedParticipantsDto,
  ) {
    await this.challengesService.releaseResults(userId, challengeId, data);
  }
}
