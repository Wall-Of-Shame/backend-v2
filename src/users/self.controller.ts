import {
  Body,
  Controller,
  Get,
  Request,
  Patch,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('self')
export class SelfController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async self(@Request() req) {
    const userId = req.user.userId;
    const user = await this.usersService.findOne({ userId });

    if (!user) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    } else {
      return user;
    }
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  updateSelf(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.userId;

    return this.usersService.update(userId, updateUserDto);
  }
}
