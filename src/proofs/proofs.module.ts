import { Module } from '@nestjs/common';
import { ChallengesService } from '../challenges/challenges.service';
import { PrismaService } from '../prisma.service';
import { ProofsController } from './proofs.controller';

@Module({
  controllers: [ProofsController],
  providers: [PrismaService, ChallengesService],
})
export class ProofsModule {}
