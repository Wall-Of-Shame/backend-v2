import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserId } from 'src/auth/user.decorator';
import { ChallengesService } from 'src/challenges/challenges.service';
import { SubmitProofDto } from './dto/submit-proof.dto';

@Controller(':challengeId/proofs')
export class ProofsController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
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