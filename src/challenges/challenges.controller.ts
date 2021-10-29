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
  Injectable,
} from '@nestjs/common';
import { Challenge } from '@prisma/client';
import { PowerUp } from 'src/store/store.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user.decorator';
import { ChallengeGateway } from './challenge.gateway';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { ApplyPowerupDto } from './entities/challenge.entity';

export type FindAllOpType = 'self' | 'explore' | 'search';

@Controller('challenges')
export class ChallengesController {
  constructor(
    private readonly challengesService: ChallengesService,
    private readonly gateway: ChallengeGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @UserId() userId: string,
    @Body() createChallengeDto: CreateChallengeDto,
  ) {
    const challenge: Challenge = await this.challengesService.create(
      userId,
      createChallengeDto,
    );
    this.gateway.addCronJob(challenge);
    return { challengeId: challenge.challengeId };
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
  async update(
    @UserId() userId: string,
    @Param('id') challengeId: string,
    @Body() updateChallengeDto: UpdateChallengeDto,
  ) {
    const challenge: Challenge = await this.challengesService.update(
      userId,
      challengeId,
      updateChallengeDto,
    );
    this.gateway.editCronJob(challenge);
    return;
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
        await this.gateway.challengeUpdateNotify(challengeId);
        return;
      case PowerUp.PROTEC:
        await this.challengesService.useProtec(userId, challengeId);
        await this.gateway.challengeUpdateNotify(challengeId);
        return;
      default:
    }
  }

  /*
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

  // Deprecated due to change in workflow
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
  */
}
