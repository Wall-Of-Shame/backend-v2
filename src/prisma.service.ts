import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient, User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { UserList } from './users/entities/user.entity';

// Internal partial interface used to handle reading from Prisma view
interface UserWithMetaData extends User {
  failedCount: number;
  completedCount: number;
  vetoedCount: number;
  totalFailedCount: number;
  protecCount: number;
}

// Internal interface used to handle reading from Prisma view
type UserWithMetaDataResult = UserWithMetaData[];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  // allow for error: any cause error handling has no strong types
  customGetMetaFields(e: any): {
    target: string[];
  } {
    const error: PrismaClientKnownRequestError = e;
    if (!error.meta) {
      // should not happen accd to docs
      return {
        target: [],
      };
    }

    const meta: { target: string[] } = error.meta as any;
    return meta;
  }

  async getUsersFromUsersView(userIds: string[]): Promise<UserList[]> {
    if (userIds.length === 0) {
      return [];
    }

    const results = await this.$queryRaw<UserWithMetaDataResult>`
      SELECT *
      FROM "UserWithMetaData"
      WHERE "username" IS NOT NULL
        AND "name" IS NOT NULL
        AND "avatar_animal" IS NOT NULL
        AND "avatar_color" IS NOT NULL
        AND "avatar_bg" IS NOT NULL
        AND "userId" IN (${Prisma.join(userIds)})
    `;

    return results.map((user) => ({
      userId: user.userId,
      username: user.username,
      name: user.name,
      avatar: {
        animal: user.avatar_animal,
        background: user.avatar_bg,
        color: user.avatar_color,
      },
      failedChallengeCount: user.failedCount,
      completedChallengeCount: user.completedCount,
      vetoedChallengeCount: user.vetoedCount,
      protecCount: user.protecCount,
    }));
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
