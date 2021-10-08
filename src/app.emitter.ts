import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { EVENTS } from 'src/app.gateway';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AppEmitter {
  constructor(
    private prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async releaseResultsNotify(
    server: Server,
    challengeId: string,
    event: string,
  ): Promise<void> {
    await this.emitNewGlobalWall(server, event);
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
