import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { UsersService } from './users.service';

import { UseGuards } from '@nestjs/common';

import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';
import { Socket } from 'net';

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class UsersGateway implements OnGatewayConnection {
  constructor(private readonly usersService: UsersService) {}

  async handleConnection(client: Socket) {
    console.log('Connection established');
  }

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('globalLeaderboard')
  getGlobalLeaderboard() {
    return this.usersService.getGlobalLeaderboard();
  }
}
