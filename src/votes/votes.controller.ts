import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserId } from 'src/auth/user.decorator';
import { ChallengesService } from 'src/challenges/challenges.service';
import { SubmitVoteDto } from './dto/submit-vote.dto';

@Controller('challenges/:challengeId/votes')
export class VotesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getVotes(
    @UserId() userId: string,
    @Param('challengeId') challengeId: string,
  ) {
    return this.challengesService.getVotes(userId, challengeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  submitVote(
    @UserId() userId: string,
    @Param('challengeId') challengeId: string,
    @Body() data: SubmitVoteDto,
  ) {
    return this.challengesService.submitVote(userId, challengeId, data);
  }
}
