import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AvatarAnimal, AvatarColor, User } from '@prisma/client';
import admin from 'firebase-admin';
import { datatype, random } from 'faker';
import { UserData } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string; // userId
}

type RandomUserInfo = Pick<
  User,
  'name' | 'username' | 'avatar_animal' | 'avatar_color' | 'avatar_bg'
>;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(args: { email: string; messagingToken: string }) {
    const { email, messagingToken } = args;

    let user: UserData;
    user = await this.usersService.findOne({ email });
    if (!user) {
      const randomUserInfo = await this.randomUserInfo();
      user = await this.usersService.create({
        ...randomUserInfo,
        email,
        messagingToken,
      });

      user = await this.usersService.findOne({ email });
    } else {
      await this.usersService.updateToken(email, {
        messagingToken,
      });
    }
    const payload = { sub: user.userId };
    return this.jwtService.sign(payload);
  }

  async verifyFirebaseToken(args: { token: string }): Promise<string | null> {
    try {
      const { token } = args;
      const email = await admin
        .auth()
        .verifyIdToken(token)
        .then((decodedToken) => decodedToken.email);

      if (!email) {
        return null;
      }
      return email;
    } catch (error) {
      return null;
    }
  }

  private async randomUserInfo(): Promise<RandomUserInfo> {
    const avatar_animal = random.arrayElement([
      AvatarAnimal.CAT,
      AvatarAnimal.DOG,
      AvatarAnimal.RABBIT,
    ]);
    const avatar_color = random.arrayElement([
      AvatarColor.PRIMARY,
      AvatarColor.SECONDARY,
      AvatarColor.TERTIARY,
    ]);
    const avatar_bg = random.arrayElement(['#cbe8e0', '#c9b2e1', '#c2d5eb']);

    let name: string;
    let username: string;
    let randomNumber: number;

    do {
      randomNumber = datatype.number({ min: 100000, max: 999999 });
      name = `User#${randomNumber}`;
      username = name;
    } while ((await this.usersService.findOne({ username })) !== null);

    return {
      name,
      username,
      avatar_animal,
      avatar_bg,
      avatar_color,
    };
  }
}
