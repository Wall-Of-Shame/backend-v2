import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user.decorator';
import { UsersService } from './users.service';

type IndexOperation = 'search' | 'wallGlobal';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Route:
   *
   * operation: 'search' | 'wallGlobal'
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  index(
    @UserId() userId: string,
    @Query('operation') operation: IndexOperation,
    @Query('query') query: string,
  ) {
    if (operation === 'search' && query) {
      return this.usersService.search(query);
    } else if (operation === 'wallGlobal') {
      return this.usersService.getGlobalLeaderboard();
    } else {
      throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  show(@Param('id') targetUserId: string) {
    if (!targetUserId) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return this.usersService.showUser({ userId: targetUserId });
  }
}
