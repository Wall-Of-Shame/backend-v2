import { MailerService } from '@nestjs-modules/mailer';
import { v2 as cloudinary } from 'cloudinary';
import { Injectable } from '@nestjs/common';
import { Challenge, User } from '.prisma/client';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendFeedback(
    email: string,
    feedback: string,
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
        feedback,
        imageUrl,
      },
    });
  }

  async sendInvites(
    challenge: Challenge,
    owner: User,
    recipients: User[],
  ): Promise<void> {
    const { title, description, startAt, endAt } = challenge;
    const { username, name } = owner;

    return;

    /*
    await Promise.all(
      recipients.map(async (receipient) => {
        await this.mailerService.sendMail({
          to: receipient.email,
          subject: `Wall Of Shame - Invitation to join ${challenge.title}`,
          template: './invitation',
          context: {
            title,
            description,
            startAt,
            endAt,
            ownerUsername: username,
            ownerName: name,
            recipientUsername: receipient.username,
            recipientName: receipient.name,
          },
        });
      }),
    );
    */
  }

  async sendFriendRequests(sender: User, receipient: User): Promise<void> {
    return;
    /*
    await this.mailerService.sendMail({
      to: receipient.email,
      subject: `Wall Of Shame - Friend request from ${sender.name}`,
      template: './friendRequest',
      context: {
        senderUsername: sender.username,
        senderName: sender.name,
        recipientUsername: receipient.username,
        recipientName: receipient.name,
      },
    });
    */
  }
}
