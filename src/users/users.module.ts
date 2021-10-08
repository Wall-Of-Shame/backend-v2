import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma.service';
import { SelfController } from './self.controller';

@Module({
  providers: [PrismaService, UsersService],
  exports: [UsersService],
  controllers: [SelfController],
})
export class UsersModule {}
