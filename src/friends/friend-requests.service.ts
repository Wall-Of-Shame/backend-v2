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
    const { userId: reqId } = createRequest;

    if (reqId === userId) {
      throw new HttpException('Cannot befriend self', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
      },
    });
    if (!user) {
      throw new HttpException('Not found', HttpStatus.UNAUTHORIZED);
    }

    const friend = await this.prisma.user.findUnique({
      where: { userId: reqId },
      select: { userId: true },
    });
    if (!friend) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const existingContact = await this.prisma.contact.findUnique({
      where: {
        pers1_id_pers2_id: {
          pers1_id: userId,
          pers2_id: reqId,
        },
      },
      select: {
        pers2_id: true,
      },
    });

    if (existingContact) {
      throw new HttpException(
        'Friend request already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.prisma.contact.create({
        data: {
          pers1_id: userId,
          pers2_id: reqId,
        },
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
