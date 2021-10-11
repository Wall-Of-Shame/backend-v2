import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import admin from 'firebase-admin';
import { UserData } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string; // userId
}

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
      user = await this.usersService.create({
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
}
