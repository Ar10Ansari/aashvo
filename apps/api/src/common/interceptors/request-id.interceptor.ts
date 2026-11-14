import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../../modules/users/users.types';

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface RequestWithId extends Request {
  requestId?: string;
  user?: AuthenticatedUser;
}

/** Resolves or generates a bounded-format X-Request-ID and binds it to the HTTP response. */
export function resolveRequestId(rawHeader: string | string[] | undefined): string {
  const candidate = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof candidate === 'string' && VALID_REQUEST_ID.test(candidate)) {
    return candidate;
  }
  return `req_${randomUUID().replace(/-/g, '')}`;
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const requestId = resolveRequestId(request.headers['x-request-id']);
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    return next.handle();
  }
}

