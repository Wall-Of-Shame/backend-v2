import { Module } from '@nestjs/common';
import configuration from './config/configuration';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { ProofsModule } from './proofs/proofs.module';
import { ConfigModule } from '@nestjs/config';
import { VotesModule } from './votes/votes.module';
import { FeedbackModule } from './feedback/feedback.module';
import { MailModule } from './mail/mail.module';
import { FriendsModule } from './friends/friends.module';
import { StoreModule } from './store/store.module';
import { ShameModule } from './shame/shame.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ChallengesModule,
    ProofsModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      load: [configuration],
    }),
    CronModule,
    VotesModule,
    FeedbackModule,
    MailModule,
    FriendsModule,
    StoreModule,
    ShameModule,
  ],
})
export class AppModule {}
