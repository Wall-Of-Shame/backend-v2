import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuthGateway } from './auth/auth.gateway';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [],
  providers: [AuthGateway],
})
export class AppModule {}
