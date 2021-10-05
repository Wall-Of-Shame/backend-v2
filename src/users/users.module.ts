import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [PrismaService, UsersGateway, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
