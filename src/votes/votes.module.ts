import { Module } from '@nestjs/common';
import { ChallengesService } from 'src/challenges/challenges.service';
import { PrismaService } from 'src/prisma.service';
import { VotesController } from './votes.controller';

@Module({
  providers: [PrismaService, ChallengesService],
  controllers: [VotesController],
})
export class VotesModule {}
