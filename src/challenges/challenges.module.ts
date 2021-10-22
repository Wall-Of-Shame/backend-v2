import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { CronService } from 'src/cron/cron.service';

@Module({
  controllers: [ChallengesController],
  providers: [CronService, PrismaService, ChallengesService, UsersService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
