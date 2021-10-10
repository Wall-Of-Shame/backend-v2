import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly mailService: MailService) {}

  @Post()
  @HttpCode(200)
  sendFeedback(
    @Body('email') email: string,
    @Body('description') description: string,
    @Body('screenshot') screenshot: string | undefined,
  ) {
    // TODO: use pipes
    if (!email || !description) {
      return;
    }
    return this.mailService.sendFeedback(email, description, screenshot);
  }
}
