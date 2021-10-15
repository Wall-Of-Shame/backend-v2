import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { FriendRequestsController } from './requests.controller';
import { FriendRequestsService } from './friend-requests.service';

@Module({
  controllers: [FriendsController, FriendRequestsController],
  providers: [FriendsService, FriendRequestsService],
})
export class FriendsModule {}
