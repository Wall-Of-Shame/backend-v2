import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { EVENTS } from 'src/app.gateway';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ChallengesEmitter {
  constructor(
    private prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async releaseResultsNotify(
    server: Server,
    challengeId: string,
  ): Promise<void> {
    await this.emitNewGlobalWall(server);
  }

  private async emitNewGlobalWall(server: Server): Promise<void> {
    const results = await this.usersService.getGlobalLeaderboard();
    server.emit(EVENTS.globalLeaderboard, results);
  }
}
