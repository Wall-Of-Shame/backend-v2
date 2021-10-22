import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserId } from 'src/auth/user.decorator';
import { ThrowItemPost } from './shame.entity';
import { ShameService } from './shame.service';

@Controller('shame')
export class ShameController {
  constructor(private readonly shameService: ShameService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async throwItem(
    @UserId() userId: string,
    @Body() throwItemData: ThrowItemPost,
  ) {
    const { challengeId, targetUserId, effect, count } = throwItemData;
    await this.shameService.throwItem(
      userId,
      challengeId,
      targetUserId,
      effect,
      count,
    );
  }
}
