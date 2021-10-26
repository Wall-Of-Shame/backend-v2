import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { FriendRequestsController } from './requests.controller';
import { FriendRequestsService } from './requests.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FriendsController, FriendRequestsController],
  providers: [PrismaService, FriendsService, FriendRequestsService],
})
export class FriendsModule {}
