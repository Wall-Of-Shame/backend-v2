import { Module } from '@nestjs/common';
import { ChallengesService } from '../challenges/challenges.service';
import { PrismaService } from '../prisma.service';
import { VotesController } from './votes.controller';

@Module({
  providers: [PrismaService, ChallengesService],
  controllers: [VotesController],
})
export class VotesModule {}
