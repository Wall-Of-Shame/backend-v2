import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ChallengesController],
  providers: [PrismaService, ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
