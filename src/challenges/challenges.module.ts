import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';

@Module({
  controllers: [ChallengesController],
  providers: [PrismaService, ChallengesService, UsersService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
