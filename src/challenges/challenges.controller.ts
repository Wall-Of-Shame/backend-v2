import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PowerUp } from 'src/store/store.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user.decorator';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { VetoedParticipantsDto } from './dto/vetoed-participants.dto';
import { ApplyPowerupDto } from './entities/challenge.entity';

export type FindAllOpType = 'self' | 'explore' | 'search';

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
  findAll(
    @UserId() userId: string,
    @Query('operation') operation: FindAllOpType,
    @Query('query') query: string,
  ) {
    let op: FindAllOpType = operation ?? 'self';

    if (op === 'self') {
      return this.challengesService.getUserChallenges(userId);
    } else if (op === 'explore') {
      return this.challengesService.getPublicChallenges(userId);
    } else if (op === 'search') {
      return this.challengesService.searchChallenges(query);
    } else {
      throw new HttpException('Invalid operation type', HttpStatus.BAD_REQUEST);
    }
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

  @Post(':id/powerups')
  @UseGuards(JwtAuthGuard)
  async applyPowerup(
    @UserId() userId: string,
    @Param('id') challengeId: string,
    @Body() applyPowerup: ApplyPowerupDto,
  ) {
    const { type } = applyPowerup;
    switch (type) {
      case PowerUp.GRIEF:
        const { type, targetUserId } = applyPowerup;
        if (!type || !targetUserId) {
          throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
        }
        await this.challengesService.useGrief(
          userId,
          challengeId,
          targetUserId,
        );
        return;
      case PowerUp.PROTEC:
        await this.challengesService.useProtec(userId, challengeId);
        return;
      default:
    }
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  acceptChallenge(@UserId() userId: string, @Param('id') challengeId) {
    return this.challengesService.acceptChallenge(userId, challengeId);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  rejectChallenge(@UserId() userId: string, @Param('id') challengeId) {
    return this.challengesService.rejectChallenge(userId, challengeId);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  completeChallenge(@UserId() userId: string, @Param('id') challengeId) {
    return this.challengesService.completeChallenge(userId, challengeId);
  }

  // To be deprecated, use the socket event instead
  @Post(':id/vetoResults')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  releaseResults(
    @UserId() userId: string,
    @Param('id') challengeId,
    @Body() results: VetoedParticipantsDto,
  ) {
    return this.challengesService.releaseResults(userId, challengeId, results);
  }
}
