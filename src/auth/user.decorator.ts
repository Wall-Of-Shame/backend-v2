import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { create } from 'lodash';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.userId;
  },
);

export const UserWsId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToWs().getClient().handshake;
    return request.user.userId;
  },
);
