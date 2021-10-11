import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user.decorator';
import { ChallengesService } from '../challenges/challenges.service';
import { SubmitProofDto } from './dto/submit-proof.dto';

@Controller('challenges/:challengeId/proofs')
export class ProofsController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  submitProof(
    @UserId() userId: string,
    @Param('challengeId') challengeId: string,
    @Body() submitProofDto: SubmitProofDto,
  ) {
    return this.challengesService.submitProof(
      userId,
      challengeId,
      submitProofDto,
    );
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  remove(@UserId() userId: string, @Param('challengeId') challengeId: string) {
    return this.challengesService.deleteProof(userId, challengeId);
  }
}
