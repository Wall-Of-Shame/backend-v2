import { Module } from '@nestjs/common';
import { ChallengesService } from 'src/challenges/challenges.service';
import { PrismaService } from 'src/prisma.service';
import { ProofsController } from './proofs.controller';

@Module({
  controllers: [ProofsController],
  providers: [PrismaService, ChallengesService],
})
export class ProofsModule {}
