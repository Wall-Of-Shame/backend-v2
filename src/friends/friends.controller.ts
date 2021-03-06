import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { UserId } from '../auth/user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnfriendDto } from './entities/friend.entity';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getFriends(@UserId() userId: string) {
    return this.friendsService.findAll(userId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  unfriend(@UserId() userId: string, @Body() unfriendDto: UnfriendDto) {
    return this.friendsService.unfriend(userId, unfriendDto);
  }
}
