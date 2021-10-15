import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { FriendRequestsService } from './friend-requests.service';
import { UserId } from '../auth/user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AcceptRequestDto,
  CreateRequestDto,
  RejectRequestDto,
} from './entities/request.entity';

@Controller('requests')
export class FriendRequestsController {
  constructor(private readonly friendRequestsService: FriendRequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@UserId() userId: string, @Body() createRequest: CreateRequestDto) {
    return this.friendRequestsService.create(userId, createRequest);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@UserId() userId: string) {
    return this.friendRequestsService.list(userId);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  accept(@UserId() userId: string, @Body() acceptRequest: AcceptRequestDto) {
    return this.friendRequestsService.accept(userId, acceptRequest);
  }

  @Post('reject')
  @UseGuards(JwtAuthGuard)
  reject(@UserId() userId: string, @Body() rejectRequest: RejectRequestDto) {
    return this.friendRequestsService.delete(userId, rejectRequest);
  }

  @Post('unfriend')
  @UseGuards(JwtAuthGuard)
  unfriend(@UserId() userId: string, @Body() rejectRequest: RejectRequestDto) {
    return this.friendRequestsService.delete(userId, rejectRequest);
  }
}
