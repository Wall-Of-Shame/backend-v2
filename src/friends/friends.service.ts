import { Injectable } from '@nestjs/common';
import { UserList } from '../users/entities/user.entity';

// TODO: Add logic in services layer

@Injectable()
export class FriendsService {
  async findAll(userId: string): Promise<UserList[]> {
    return [];
  }
}
