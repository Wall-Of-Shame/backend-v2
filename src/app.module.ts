import { Module } from '@nestjs/common';
import configuration from './config/configuration';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { ProofsModule } from './proofs/proofs.module';
import { ConfigModule } from '@nestjs/config';
import { AppGateway } from './app.gateway';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ChallengesModule,
    ProofsModule,
    ConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  providers: [AppGateway],
})
export class AppModule {}
