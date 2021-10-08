import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UsersService } from './users.service';
import { UseGuards } from '@nestjs/common';
import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';
import { Socket } from 'socket.io';
import { UserList } from './entities/user.entity';

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
  async getGlobalLeaderboard(@ConnectedSocket() socket: Socket) {
    const results: UserList[] = await this.usersService.getGlobalLeaderboard();
    socket.emit(EVENTS.GlobalLeaderboard, results);
  }
}
