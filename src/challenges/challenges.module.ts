import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { CronService } from 'src/cron/cron.service';
import { ChallengeGateway } from './challenge.gateway';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [ChallengesController],
  providers: [
    CronService,
    PrismaService,
    ChallengesService,
    UsersService,
    ChallengeGateway,
  ],
  exports: [ChallengesService, ChallengeGateway],
})
export class ChallengesModule {}
