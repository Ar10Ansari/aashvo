import { ERROR_CODES } from '@aashvo/contracts';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AppConfig } from '../../infrastructure/config/env.schema';
import type { AuthenticatedUser } from '../users/users.types';
import { AuthService, type IssuedAuthSession, type RequestMetadata } from './auth.service';
import {
  AuthSessionResponseDto,
  AuthUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MessageAcceptedDto,
  RefreshDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

function resolveClientPlatform(request: Request): 'web' | 'ios' | 'android' {
  const raw = request.headers['x-client-platform'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (header === 'ios' || header === 'android') {
    return header;
  }
  return 'web';
}

function buildRequestMetadata(request: RequestWithId): RequestMetadata {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip ?? null,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : null,
    requestId: request.requestId ?? null,
    clientPlatform: resolveClientPlatform(request),
  };
}

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  private readonly cookieSecure: boolean;
  private readonly cookieName: string;
  private readonly allowedOrigins: string[];

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService<AppConfig, true>,
  ) {
    const env = configService.get('NODE_ENV', { infer: true });
    const explicitSecure = configService.get('COOKIE_SECURE', { infer: true });
    this.cookieSecure =
      explicitSecure !== undefined
        ? explicitSecure
        : env === 'production' || env === 'staging';
    this.cookieName = this.cookieSecure ? '__Host-aashvo_rt' : 'aashvo_rt';
    this.allowedOrigins = configService.get('CORS_ALLOWED_ORIGINS', { infer: true });
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSecure ? 'none' : 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSecure ? 'none' : 'lax',
      path: '/',
    });
  }

  private assertCookieOriginAllowed(request: Request): void {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Cross-origin cookie request denied.',
      });
    }
  }

  private toClientResponse(
    session: IssuedAuthSession,
    platform: 'web' | 'ios' | 'android',
    response: Response,
  ): AuthSessionResponseDto {
    if (platform === 'web') {
      this.setRefreshCookie(response, session.rawRefreshToken, session.refreshExpiresAt);
    }

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.rawRefreshToken,
      user: session.user,
    };
  }

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Register a new user account and profile' })
  @ApiResponse({ status: 201, type: AuthSessionResponseDto })
  @ApiResponse({ status: 409, description: 'Duplicate email rejected' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const meta = buildRequestMetadata(request);
    const session = await this.authService.register(dto, meta);
    return this.toClientResponse(session, meta.clientPlatform, response);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 900000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, type: AuthSessionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or locked account' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const meta = buildRequestMetadata(request);
    const session = await this.authService.login(dto, meta);
    return this.toClientResponse(session, meta.clientPlatform, response);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate opaque refresh token and issue a fresh access JWT' })
  @ApiResponse({ status: 200, type: AuthSessionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or replayed refresh token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const meta = buildRequestMetadata(request);
    const cookieToken = request.cookies?.[this.cookieName] as string | undefined;

    if (!dto.refreshToken && cookieToken) {
      this.assertCookieOriginAllowed(request);
    }

    const presentedToken = dto.refreshToken ?? cookieToken;
    if (!presentedToken) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Refresh token is required.',
      });
    }

    try {
      const session = await this.authService.refresh(presentedToken, meta);
      return this.toClientResponse(session, meta.clientPlatform, response);
    } catch (err) {
      if (meta.clientPlatform === 'web') {
        this.clearRefreshCookie(response);
      }
      throw err;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke current session family and clear web refresh cookie' })
  @ApiResponse({ status: 204 })
  async logout(
    @Body() dto: RefreshDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const meta = buildRequestMetadata(request);
    const cookieToken = request.cookies?.[this.cookieName] as string | undefined;

    if (!dto.refreshToken && cookieToken) {
      this.assertCookieOriginAllowed(request);
    }

    const authHeader = request.headers.authorization;
    const accessToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    await this.authService.logout({
      rawRefreshToken: dto.refreshToken ?? cookieToken,
      accessToken,
      meta,
    });

    this.clearRefreshCookie(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Revoke all active refresh sessions for authenticated user' })
  @ApiResponse({ status: 204 })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id, user.role, buildRequestMetadata(request));
    this.clearRefreshCookie(response);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using single-use token' })
  @ApiResponse({ status: 200, type: MessageAcceptedDto })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: RequestWithId,
  ): Promise<MessageAcceptedDto> {
    await this.authService.verifyEmail(dto.token, buildRequestMetadata(request));
    return { message: 'Email verified successfully.' };
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Request fresh email verification message (constant generic response)' })
  @ApiResponse({ status: 202, type: MessageAcceptedDto })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<MessageAcceptedDto> {
    await this.authService.resendVerification(dto.email);
    return {
      message: 'If an unverified account matches that email, a verification link has been queued.',
    };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Request password recovery message (constant generic response)' })
  @ApiResponse({ status: 202, type: MessageAcceptedDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: RequestWithId,
  ): Promise<MessageAcceptedDto> {
    await this.authService.requestPasswordReset(dto.email, buildRequestMetadata(request));
    return {
      message: 'If an active account matches that email, a password reset link has been queued.',
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Consume password reset token and revoke all existing sessions' })
  @ApiResponse({ status: 200, type: MessageAcceptedDto })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: RequestWithId,
  ): Promise<MessageAcceptedDto> {
    await this.authService.resetPassword(dto, buildRequestMetadata(request));
    return { message: 'Password reset successfully. Please sign in with your new password.' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Change password with current-password step-up and revoke active sessions' })
  @ApiResponse({ status: 200, type: MessageAcceptedDto })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageAcceptedDto> {
    await this.authService.changePassword(user.id, dto, buildRequestMetadata(request));
    this.clearRefreshCookie(response);
    return { message: 'Password changed successfully. Please sign in again.' };
  }

  @Get('me')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Return authoritative authenticated user profile' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.getCurrentProfile(user.id);
  }
}

