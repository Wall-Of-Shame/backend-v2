import { Module } from '@nestjs/common';
import { ChallengesModule } from 'src/challenges/challenges.module';
import { CronModule } from 'src/cron/cron.module';
import { PrismaService } from '../prisma.service';
import { VotesController } from './votes.controller';

@Module({
  imports: [CronModule, ChallengesModule],
  providers: [PrismaService],
  controllers: [VotesController],
})
export class VotesModule {}
