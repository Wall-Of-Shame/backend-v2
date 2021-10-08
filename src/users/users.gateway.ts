import { WebSocketGateway, SubscribeMessage } from '@nestjs/websockets';
import { UsersService } from './users.service';

import { UseGuards } from '@nestjs/common';

import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class UsersGateway {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('globalLeaderboard')
  getGlobalLeaderboard() {
    return this.usersService.getGlobalLeaderboard();
  }
}
