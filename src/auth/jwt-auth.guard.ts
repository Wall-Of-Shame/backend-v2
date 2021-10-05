import { ExecutionContext, Global, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Global()
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    return context.switchToWs().getClient().handshake;
  }
}
