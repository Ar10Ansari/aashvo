import { ERROR_CODES } from '@aashvo/contracts';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../users/users.types';
import { UsersService } from '../../users/users.service';
import { JwtTokenService } from '../services/jwt-token.service';
import { RefreshSessionService } from '../services/refresh-session.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtTokenService: JwtTokenService,
    private readonly usersService: UsersService,
    private readonly refreshSessions: RefreshSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractBearerToken(request);

    if (isPublic) {
      if (token) {
        try {
          const claims = this.jwtTokenService.verifyAccessToken(token);
          const [userRecord, isSessionActive] = await Promise.all([
            this.usersService.findActiveAuthStatus(claims.sub),
            this.refreshSessions.isSessionFamilyActive(claims.sid),
          ]);
          if (userRecord && userRecord.accountStatus === 'active' && isSessionActive) {
            request.user = {
              id: userRecord.id,
              email: userRecord.email,
              role: userRecord.role,
              accountStatus: userRecord.accountStatus,
              sessionFamilyId: claims.sid,
            };
          }
        } catch {
          // Public endpoint: proceed anonymously if optional token is invalid or expired
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication token is required.',
      });
    }

    const claims = this.jwtTokenService.verifyAccessToken(token);

    const [userRecord, isSessionActive] = await Promise.all([
      this.usersService.findActiveAuthStatus(claims.sub),
      this.refreshSessions.isSessionFamilyActive(claims.sid),
    ]);

    if (!userRecord || userRecord.accountStatus !== 'active' || !isSessionActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Session is no longer active.',
      });
    }

    request.user = {
      id: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      accountStatus: userRecord.accountStatus,
      sessionFamilyId: claims.sid,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    return token.trim();
  }
}

