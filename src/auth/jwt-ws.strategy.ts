import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { jwtConstants } from './constants';

interface WsReqType {
  auth: {
    token: string;
  };
}

@Injectable()
export class JwtWsStrategy extends PassportStrategy(Strategy, 'jwt-ws') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (r) => {
          const req = r as unknown as WsReqType;
          return req.auth.token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub };
  }
}
