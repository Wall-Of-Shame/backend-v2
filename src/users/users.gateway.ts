import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@WebSocketGateway()
export class UsersGateway {
  constructor(private readonly usersService: UsersService) {}

  @SubscribeMessage('getGlobalLeaderboard')
  getGlobalLeaderboard() {
    return this.usersService.getGlobalLeaderboard();
  }

  @SubscribeMessage('updateUser')
  update(@MessageBody() updateUserDto: UpdateUserDto) {
    return this.usersService.update(updateUserDto);
  }
}
