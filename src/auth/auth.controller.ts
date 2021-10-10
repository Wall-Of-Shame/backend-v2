import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UsersService,
  ) {}

  @Post()
  @HttpCode(200)
  async login(
    @Body('token') token: string,
    @Body('messageToken') messagingToken: string,
  ) {
    const email = await this.authService.verifyFirebaseToken({ token });

    if (!email) {
      return;
    } else {
      const token = await this.authService.login({ email, messagingToken });
      const user = await this.userService.findOne({ email });
      return { token, user };
    }
  }
}
