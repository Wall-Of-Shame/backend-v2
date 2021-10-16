import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserList } from '../users/entities/user.entity';
import {
  AcceptRequestDto,
  CreateRequestDto,
  RejectRequestDto,
} from './entities/request.entity';

@Injectable()
export class FriendRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createRequest: CreateRequestDto): Promise<void> {
    const { userIds: reqIds } = createRequest;
    let users: { userId: string }[] = undefined;

    const user = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new HttpException('Not found', HttpStatus.UNAUTHORIZED);
    }
    if (reqIds.includes(userId)) {
      throw new HttpException('Cannot befriend self', HttpStatus.BAD_REQUEST);
    }

    users = await this.prisma.user.findMany({
      where: {
        // cannot befriend yourself
        userId: { in: reqIds },
      },
      select: {
        userId: true,
      },
    });
    if (users.length === 0) {
      throw new HttpException('No valid userIds given', HttpStatus.BAD_REQUEST);
    }

    const exisingContacts = await this.prisma.contact.findMany({
      where: {
        pers1_id: userId,
        pers2_id: { in: reqIds },
      },
      select: {
        pers2_id: true,
      },
    });

    const toCreateIds = users
      .filter((u) => !exisingContacts.find((contact) => contact.pers2_id))
      .map((u) => u.userId);

    try {
      await this.prisma.contact.createMany({
        data: toCreateIds.map((pers2_id) => ({
          pers1_id: userId,
          pers2_id,
        })),
      });
    } catch (error) {
      console.log(error);
      // allow for server 500 error here: this means prisma query threw some error
      throw new Error('Unknown error');
    }
  }

  async list(userId: string): Promise<UserList[]> {
    const pendingRequests = await this.prisma.contact.findMany({
      where: {
        pers2_id: userId,
        accepted_at: null,
      },
      select: {
        pers1_id: true,
      },
    });

    const users: UserList[] = await this.prisma.getUsersFromUsersView(
      pendingRequests.map((r) => r.pers1_id),
    );
    return users;
  }

  async accept(userId: string, acceptRequest: AcceptRequestDto): Promise<void> {
    const { userId: reqId } = acceptRequest;

    if (userId === reqId) {
      throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    }

    const request = await this.prisma.contact.findUnique({
      where: {
        pers1_id_pers2_id: {
          pers1_id: reqId,
          pers2_id: userId,
        },
      },
    });

    if (!request) {
      throw new HttpException('Invalid request', HttpStatus.NOT_FOUND);
    }

    if (request.accepted_at) {
      // have already been accepted
      // do nothing, return success
      return;
    }

    const now = new Date();
    await this.prisma.$transaction([
      // befriender -> accept
      this.prisma.contact.update({
        where: {
          pers1_id_pers2_id: {
            pers1_id: reqId,
            pers2_id: userId,
          },
        },
        data: {
          accepted_at: now,
        },
      }),

      // create inverse
      this.prisma.contact.create({
        data: {
          pers1_id: userId,
          pers2_id: reqId,
          accepted_at: now,
        },
      }),
    ]);
  }

  async delete(userId: string, rejectRequest: RejectRequestDto): Promise<void> {
    const { userId: reqId } = rejectRequest;

    const requests = await this.prisma.contact.findMany({
      where: {
        OR: [
          { pers1_id: reqId, pers2_id: userId },
          { pers1_id: userId, pers2_id: reqId },
        ],
      },
    });

    if (requests.length === 0) {
      return;
    }

    try {
      await this.prisma.contact.deleteMany({
        where: {
          OR: [
            { pers1_id: reqId, pers2_id: userId },
            { pers1_id: userId, pers2_id: reqId },
          ],
        },
      });
    } catch (error) {
      console.log(error);
      // allow for server 500 error here: this means prisma query threw some error
      throw new Error('Unknown error');
    }
  }
}
