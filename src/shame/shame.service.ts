import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { EffectType } from './shame.entity';

@Injectable()
export class ShameService {
  constructor(private readonly prisma: PrismaService) {}

  async throwItem(
    userId: string,
    challengeId: string,
    targetUserId: string,
    effect: EffectType,
    count: number,
  ): Promise<void> {
    if (count < 1) {
      throw new HttpException('Invalid count number', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    }

    const failedParticipant = await this.prisma.participant
      .findMany({
        where: {
          challengeId,
          userId: targetUserId,
          joined_at: { not: null },
          applied_protec: null,
          OR: [{ completed_at: null }, { has_been_vetoed: true }],
        },
      })
      .then((res) => res[0]);
    if (!failedParticipant) {
      throw new HttpException('Participant not found', HttpStatus.BAD_REQUEST);
    }

    switch (effect) {
      case 'TOMATO':
        await this.prisma.participant.update({
          where: {
            challengeId_userId: { challengeId, userId: targetUserId },
          },
          data: {
            effect_tomato: { increment: count },
          },
        });
        return;
      case 'EGG':
        await this.prisma.participant.update({
          where: {
            challengeId_userId: { challengeId, userId: targetUserId },
          },
          data: {
            effect_egg: { increment: count },
          },
        });
        return;
      case 'POOP':
        await this.prisma.participant.update({
          where: {
            challengeId_userId: { challengeId, userId: targetUserId },
          },
          data: {
            effect_poop: { increment: count },
          },
        });
        return;
      default:
        throw new HttpException('Unknown effect type', HttpStatus.BAD_REQUEST);
    }
  }
}
