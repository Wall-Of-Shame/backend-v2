import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UserList } from '../users/entities/user.entity';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<UserList[]> {
    const friends = await this.prisma.contact.findMany({
      where: {
        pers1_id: userId,
        accepted_at: { not: null },
      },
      select: {
        pers2_id: true,
      },
    });

    const friendIds: string[] = friends.map((f) => f.pers2_id);

    const results: UserList[] = await this.prisma.getUsersFromUsersView(
      friendIds,
    );

    return results ?? [];
  }
}
