import { Controller, Get, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { UserId } from '../auth/user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getFriends(@UserId() userId: string) {
    return this.friendsService.findAll(userId);
  }
}
