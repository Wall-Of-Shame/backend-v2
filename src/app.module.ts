import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { ProofsModule } from './proofs/proofs.module';

@Module({
  imports: [UsersModule, AuthModule, ChallengesModule, ProofsModule],
  providers: [],
})
export class AppModule {}
