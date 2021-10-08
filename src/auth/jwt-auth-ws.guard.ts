import { ExecutionContext, Global, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Global()
@Injectable()
export class JwtWsAuthGuard extends AuthGuard('jwt-ws') {
  getRequest(context: ExecutionContext) {
    return context.switchToWs().getClient().handshake;
  }
}
