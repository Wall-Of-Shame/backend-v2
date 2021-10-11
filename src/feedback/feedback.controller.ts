import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly mailService: MailService) {}

  /**
   * Input
   *
   * ```
   * {
   *  email: string,
   *  description: string,
   *  screenshot: string | undefined
   * }
   * ```
   */
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
