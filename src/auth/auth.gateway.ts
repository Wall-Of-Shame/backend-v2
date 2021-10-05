import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';

@WebSocketGateway()
export class AuthGateway {
  constructor(
    private authService: AuthService,
    private userService: UsersService,
  ) {}

  @SubscribeMessage('authLogin')
  async login(
    @MessageBody('token') token: string,
    @MessageBody('messageToken') messagingToken: string,
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
