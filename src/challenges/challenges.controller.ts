import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserId } from 'src/auth/user.decorator';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { VetoedParticipantsDto } from './dto/vetoed-participants.dto';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @UserId() userId: string,
    @Body() createChallengeDto: CreateChallengeDto,
  ) {
    return this.challengesService.create(userId, createChallengeDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@UserId() userId: string) {
    return this.challengesService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') challengeId: string) {
    return this.challengesService.findOne(challengeId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @UserId() userId: string,
    @Param('id') challengeId: string,
    @Body() updateChallengeDto: UpdateChallengeDto,
  ) {
    return this.challengesService.update(
      userId,
      challengeId,
      updateChallengeDto,
    );
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  acceptChallenge(@UserId() userId: string, @Param('id') challengeId) {
    return this.challengesService.acceptChallenge(userId, challengeId);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  rejectChallenge(@UserId() userId: string, @Param('id') challengeId) {
    return this.challengesService.rejectChallenge(userId, challengeId);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  completeChallenge(@UserId() userId: string, @Param('id') challengeId) {
    return this.challengesService.completeChallenge(userId, challengeId);
  }

  @Post(':id/vetoResults')
  @UseGuards(JwtAuthGuard)
  releaseResults(
    @UserId() userId: string,
    @Param('id') challengeId,
    @Body() results: VetoedParticipantsDto,
  ) {
    return this.challengesService.releaseResults(userId, challengeId, results);
  }
}
