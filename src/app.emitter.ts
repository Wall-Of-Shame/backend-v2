import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EVENTS } from './app.gateway';
import { PrismaService } from './prisma.service';
import { UsersService } from './users/users.service';
import { ChallengesService } from './challenges/challenges.service';
import { ChallengeData } from './challenges/entities/challenge.entity';

@Injectable()
export class AppEmitter {
  constructor(
    private prisma: PrismaService,
    private readonly challengesService: ChallengesService,
    private readonly usersService: UsersService,
  ) {}

  async releaseResultsNotify(
    server: Server,
    challengeId: string,
    event: string,
  ): Promise<void> {
    await this.emitNewGlobalWall(server, event);
  }

  async challengeUpdateNotify(
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
    server.emit(EVENTS.globalLeaderboard, results);
    console.log('SOCKET: -<GLOBAL>- || EVENT: ' + event);
  }
}
