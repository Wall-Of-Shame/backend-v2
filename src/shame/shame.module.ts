import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ShameController } from './shame.controller';
import { ShameService } from './shame.service';

@Module({
  controllers: [ShameController],
  providers: [PrismaService, ShameService],
})
export class ShameModule {}
