import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { PrismaService } from 'src/prisma.service';
import { SelfController } from './self.controller';

@Module({
  providers: [PrismaService, UsersGateway, UsersService],
  exports: [UsersService],
  controllers: [SelfController],
})
export class UsersModule {}
