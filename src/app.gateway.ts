import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { UsersService } from './users/users.service';
import { UseGuards } from '@nestjs/common';
import { JwtWsAuthGuard } from 'src/auth/jwt-auth-ws.guard';
import { Server, Socket } from 'socket.io';
import { UserList } from './users/entities/user.entity';

const EVENTS = {
  Connection: 'connection',
  GlobalLeaderboard: 'globalLeaderboard',
};

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class AppGateway implements OnGatewayConnection {
  constructor(private readonly usersService: UsersService) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    console.log(`Connection established with ${client.id}`);
    client.emit(EVENTS.Connection, { clientId: client.id });
  }

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage(EVENTS.GlobalLeaderboard)
  async getGlobalLeaderboard(@ConnectedSocket() socket: Socket) {
    const results: UserList[] = await this.usersService.getGlobalLeaderboard();
    socket.emit(EVENTS.GlobalLeaderboard, results);
  }
}
