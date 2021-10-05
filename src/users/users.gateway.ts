import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CSocket } from 'src/utils';

@WebSocketGateway()
export class UsersGateway {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('globalLeaderboard')
  getGlobalLeaderboard() {
    return this.usersService.getGlobalLeaderboard();
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('updateUser')
  update(
    @MessageBody() updateUserDto: UpdateUserDto,
    @ConnectedSocket() client: CSocket,
  ) {
    const userId = client.handshake.user.userId;
    console.log(userId);
    return this.usersService.update(updateUserDto);
  }
}
