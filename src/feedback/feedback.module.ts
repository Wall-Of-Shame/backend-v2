import { Module } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { FeedbackController } from './feedback.controller';

@Module({
  controllers: [FeedbackController],
  providers: [MailService],
})
export class FeedbackModule {}
