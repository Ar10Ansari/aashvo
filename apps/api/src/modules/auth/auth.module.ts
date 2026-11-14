import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtTokenService } from './services/jwt-token.service';
import {
  MAIL_DISPATCH_PORT,
  OutboxMailDispatchAdapter,
} from './services/mail-dispatch.port';
import { PasswordService } from './services/password.service';
import { RefreshSessionService } from './services/refresh-session.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtTokenService,
    RefreshSessionService,
    JwtAuthGuard,
    {
      provide: MAIL_DISPATCH_PORT,
      useClass: OutboxMailDispatchAdapter,
    },
  ],
  exports: [JwtTokenService, RefreshSessionService, JwtAuthGuard, UsersModule],
})
export class AuthModule {}

