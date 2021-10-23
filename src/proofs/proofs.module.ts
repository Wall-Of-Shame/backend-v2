import { Module } from '@nestjs/common';
import { ChallengesModule } from 'src/challenges/challenges.module';
import { CronModule } from 'src/cron/cron.module';
import { PrismaService } from '../prisma.service';
import { ProofsController } from './proofs.controller';

@Module({
  imports: [CronModule, ChallengesModule],
  controllers: [ProofsController],
  providers: [PrismaService],
})
export class ProofsModule {}
