import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserMsgToken } from './dto/update-user.dto';
import { UserData, UserList } from './entities/user.entity';

// TODO: Move the querying from views into prisma service

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
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Creates a user
  async create(createUserDto: CreateUserDto): Promise<UserData> {
    try {
      const { email, messagingToken } = createUserDto;

      if (messagingToken) {
        await this.prisma.user.create({
          data: {
            email,
            fb_reg_token: messagingToken,
            fb_reg_token_time: new Date(),
          },
        });
      } else {
        await this.prisma.user.create({
          data: {
            email,
          },
        });
      }

      return this.findOne({ email });
    } catch (error) {
      // TODO
      console.log(error);
    }
  }

  // Updates the user details - the usual update for the user.
  async update(userId: string, updateUserDto: UpdateUserDto): Promise<void> {
    try {
      const { name, username, avatar, settings } = updateUserDto;

      await this.prisma.user.update({
        where: {
          userId,
        },
        data: {
          name,
          username,
          avatar_animal: avatar.animal,
          avatar_bg: avatar.background,
          avatar_color: avatar.color,
          cfg_deadline_reminder: settings.deadlineReminder,
          cfg_invites_notif: settings.invitations,
        },
      });
    } catch (error) {
      // TODO - catch for prisma errors
      console.log(error);
    }
  }

  // Finds one user based on userId or email
  // Can return invalid users
  async findOne(args: {
    userId?: string | undefined;
    email?: string | undefined;
  }): Promise<UserData | null> {
    const { userId, email } = args;

    if (!userId && !email) {
      throw new Error('Invalid call - need to supply either email or userId');
    }

    let results: UserWithMetaDataResult;
    try {
      if (userId) {
        results = await this.prisma.$queryRaw<UserWithMetaDataResult>`
          SELECT *
          FROM "UserWithMetaData"
          WHERE "userId" = ${userId}
          LIMIT 1
        `;
      } else if (email) {
        results = await this.prisma.$queryRaw<UserWithMetaDataResult>`
          SELECT *
          FROM "UserWithMetaData"
          WHERE "email" = ${email}
          LIMIT 1
        `;
      }
    } catch (error) {
      // No such user
      return null;
    }

    if (results.length === 0) {
      return null;
    }

    const user = results[0];

    const userFriends = await this.prisma.user.findFirst({
      where: { userId: user.userId },
      include: {
        contacts_pers1: true,
      },
    });

    const pendingAccept: string[] = [];
    const accepted: string[] = [];
    userFriends.contacts_pers1.forEach((c) => {
      if (c.accepted_at) {
        accepted.push(c.pers2_id);
      } else {
        pendingAccept.push(c.pers2_id);
      }
    });

    return {
      userId: user.userId,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar: {
        animal: user.avatar_animal,
        color: user.avatar_color,
        background: user.avatar_bg,
      },
      settings: {
        deadlineReminder: user.cfg_deadline_reminder,
        invitations: user.cfg_invites_notif,
      },
      store: {
        points: user.points,
        protecCount: user.powerup_protec_count,
        griefCount: user.powerup_grief_count,
      },
      friends: {
        accepted,
        pendingAccept,
      },
      failedChallengeCount: user.failedCount,
      completedChallengeCount: user.completedCount,
      vetoedChallengeCount: user.vetoedCount,
    };
  }

  async showUser(args: {
    userId?: string | undefined;
    email?: string | undefined;
  }): Promise<UserList> {
    const u = await this.findOne(args);

    if (
      !u.username ||
      !u.name ||
      !u.avatar.animal ||
      !u.avatar.background ||
      !u.avatar.color
    ) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const user: UserList = {
      userId: u.userId,
      username: u.username,
      name: u.name,
      failedChallengeCount: u.failedChallengeCount,
      completedChallengeCount: u.completedChallengeCount,
      vetoedChallengeCount: u.vetoedChallengeCount,
      protecCount: u.protecCount,
      avatar: {
        animal: u.avatar.animal,
        color: u.avatar.color,
        background: u.avatar.background,
      },
    };
    return user;
  }

  // Updates the token only.
  // This should be used during authorisation to get the latest registration token for notifs.
  async updateToken(
    email: string,
    updateUserMsgToken: UpdateUserMsgToken,
  ): Promise<void> {
    try {
      const { messagingToken } = updateUserMsgToken;
      if (!messagingToken) {
        return;
      }

      await this.prisma.user.update({
        where: {
          email,
        },
        data: {
          fb_reg_token: messagingToken,
          fb_reg_token_time: new Date(),
        },
      });
    } catch (error) {
      // TODO: catch for unfound email
      console.log(error);
    }
  }

  // Searches the whole table for matching username and name
  // Cannot return invalid users
  async search(query: string): Promise<UserList[]> {
    try {
      const userIds: string[] = await this.prisma.user
        .findMany({
          where: {
            AND: [
              { username: { not: null } },
              { name: { not: null } },
              { avatar_animal: { not: null } },
              { avatar_bg: { not: null } },
              { avatar_color: { not: null } },
              {
                OR: [
                  { username: { contains: query, mode: 'insensitive' } },
                  { name: { contains: query, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: {
            userId: true,
          },
        })
        .then((result) => result.map((u) => u.userId));

      if (userIds.length === 0) {
        return [];
      }

      const results = await this.prisma.$queryRaw<UserWithMetaDataResult>`
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
    } catch (error) {
      // TODO - prisma error
      console.log(error);
    }
  }

  // Searches the whole table for matching username and name
  // Cannot return invalid users
  async getGlobalLeaderboard(): Promise<UserList[]> {
    try {
      const results = await this.prisma.$queryRaw<UserWithMetaDataResult>`
        SELECT *
        FROM "UserWithMetaData"
        WHERE "username" IS NOT NULL
          AND "name" IS NOT NULL
          AND "avatar_animal" IS NOT NULL
          AND "avatar_color" IS NOT NULL
          AND "avatar_bg" IS NOT NULL
          AND "totalFailedCount" > 0
        ORDER BY "totalFailedCount" DESC, "username" ASC
        LIMIT 100
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
    } catch (error) {
      // TODO - prisma error
      console.log(error);
    }
  }

  //
  async getUserLeaderboard(userId: string): Promise<UserList[]> {
    try {
      const recentIds: string[] = await this.prisma.contact
        .findMany({
          where: { pers1_id: userId },
          select: {
            pers2_id: true,
          },
        })
        .then((result) => result.map((v) => v.pers2_id));

      const results = await this.prisma.$queryRaw<UserWithMetaDataResult>`
        SELECT *
        FROM "UserWithMetaData"
        WHERE "username" IS NOT NULL
          AND "name" IS NOT NULL
          AND "avatar_animal" IS NOT NULL
          AND "avatar_color" IS NOT NULL
          AND "avatar_bg" IS NOT NULL
          AND "userId" IN (${Prisma.join(recentIds)})
          AND "totalFailedCount" > 0
        ORDER BY "totalFailedCount" DESC, "username" ASC
        LIMIT 100
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
    } catch (error) {
      // TODO - prisma error
      console.log(error);
    }
  }
}
