import { Module } from '@nestjs/common';
import configuration from './config/configuration';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { ProofsModule } from './proofs/proofs.module';
import { ConfigModule } from '@nestjs/config';

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
  providers: [],
})
export class AppModule {}
