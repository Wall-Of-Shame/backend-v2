import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChallengeGateway } from 'src/challenges/challenge.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user.decorator';
import { ChallengesService } from '../challenges/challenges.service';
import { SubmitVoteDto } from './dto/submit-vote.dto';

@Controller('challenges/:challengeId/votes')
export class VotesController {
  constructor(
    private readonly challengesService: ChallengesService,
    private readonly gateway: ChallengeGateway,
  ) {}

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
  async submitVote(
    @UserId() userId: string,
    @Param('challengeId') challengeId: string,
    @Body() data: SubmitVoteDto,
  ) {
    if (!challengeId) {
      throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    }

    const victimId = await this.challengesService.submitVote(
      userId,
      challengeId,
      data,
    );

    if (!victimId) {
      return;
    }

    this.gateway.notifyCheater(victimId, challengeId);
    return;
  }
}
