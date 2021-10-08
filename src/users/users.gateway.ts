import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { UsersService } from './users.service';
import { UseGuards } from '@nestjs/common';
import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';
import { Socket } from 'socket.io';

const EVENTS = {
  GlobalLeaderboard: 'globalLeaderboard',
};
@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class UsersGateway implements OnGatewayConnection {
  constructor(private readonly usersService: UsersService) {}

  async handleConnection(client: Socket) {
    console.log(`Connection established with ${client.id}`);
  }

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.GlobalLeaderboard)
  getGlobalLeaderboard() {
    return this.usersService.getGlobalLeaderboard();
  }
}
