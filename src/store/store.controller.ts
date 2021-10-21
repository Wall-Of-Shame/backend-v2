import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserId } from 'src/auth/user.decorator';
import { PurchasePost } from './store.entity';
import { StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async buyPowerup(@UserId() userId: string, @Body() data: PurchasePost) {
    const { powerup, count } = data;
    await this.storeService.buyPowerup(userId, powerup, count);
  }
}
