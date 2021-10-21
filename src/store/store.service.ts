import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PowerUp, POWER_UP_PRICE } from './store.entity';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly priceList = POWER_UP_PRICE;

  async buyPowerup(
    userId: string,
    powerUp: PowerUp,
    count: number,
  ): Promise<void> {
    const price: number = this.priceList[powerUp];
    if (!price) {
      throw new HttpException('Unknown power up', HttpStatus.BAD_REQUEST);
    }
    if (count < 1) {
      throw new HttpException(
        'Count has to be at least 1',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    }

    if (user.points < count * price) {
      throw new HttpException('Insufficent funds', HttpStatus.BAD_REQUEST);
    }

    switch (powerUp) {
      case PowerUp.GRIEF:
        await this.prisma.user.update({
          where: { userId },
          data: {
            points: { decrement: count * price },
            powerup_grief_count: { increment: count },
          },
        });
        return;
      case PowerUp.PROTEC:
        await this.prisma.user.update({
          where: { userId },
          data: {
            points: { decrement: count * price },
            powerup_protec_count: { increment: count },
          },
        });
        return;
      default:
        throw new HttpException('Unknown power up', HttpStatus.BAD_REQUEST);
    }
  }
}
