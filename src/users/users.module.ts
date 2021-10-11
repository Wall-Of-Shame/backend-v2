import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { SelfController } from './self.controller';
import { UsersController } from './users.controller';

@Module({
  providers: [PrismaService, UsersService],
  exports: [UsersService],
  controllers: [SelfController, UsersController],
})
export class UsersModule {}
