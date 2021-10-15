import { Injectable } from '@nestjs/common';
import { UserList } from '../users/entities/user.entity';
import {
  AcceptRequestDto,
  CreateRequestDto,
  RejectRequestDto,
} from './entities/request.entity';

// TODO: Add logic in services layer

@Injectable()
export class FriendRequestsService {
  async create(
    userId: string,
    createRequest: CreateRequestDto,
  ): Promise<void> {}

  async list(userId: string): Promise<UserList[]> {
    return [];
  }

  async accept(
    userId: string,
    acceptRequest: AcceptRequestDto,
  ): Promise<void> {}

  async reject(
    userId: string,
    rejectRequest: RejectRequestDto,
  ): Promise<void> {}
}
