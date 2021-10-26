import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserList } from '../users/entities/user.entity';
import { UnfriendDto } from './entities/friend.entity';

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

  async unfriend(userId: string, unfriendDto: UnfriendDto): Promise<void> {
    const { userId: pers2Id } = unfriendDto;

    // TODO: move validation somewhere else
    if (!userId || !pers2Id) {
      throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    }

    const friend = await this.prisma.contact.findFirst({
      where: { pers1_id: userId, pers2_id: pers2Id },
    });

    if (!friend) {
      throw new HttpException('Friend not found', HttpStatus.BAD_REQUEST);
    } else if (!friend.accepted_at) {
      throw new HttpException('Invalid call', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.contact.deleteMany({
      where: {
        OR: [
          { pers1_id: userId, pers2_id: pers2Id },
          { pers1_id: pers2Id, pers2_id: userId },
        ],
      },
    });
  }
}
