import { MailerService } from '@nestjs-modules/mailer';
import { v2 as cloudinary } from 'cloudinary';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendFeedback(
    email: string,
    description: string,
    image: string | undefined,
  ): Promise<void> {
    let imageUrl: string;
    if (image) {
      try {
        imageUrl = await cloudinary.uploader
          .upload(image, {
            folder: 'feedback',
          })
          .then((res) => res.url);
      } catch (error) {
        // Likely cloudinary error, just ignore it
        console.log('Error while uploading screenshot', error);
      }
    }

    await this.mailerService.sendMail({
      to: process.env.EMAIL_HOST,
      subject: `Feedback from ${email}`,
      template: './feedback',
      context: {
        email,
        description,
        imageUrl,
      },
    });
  }
}
