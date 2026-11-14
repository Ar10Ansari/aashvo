import { ERROR_CODES, type ApiErrorResponse } from '@aashvo/contracts';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type RequestWithId,
  resolveRequestId,
} from '../interceptors/request-id.interceptor';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const HTTP_STATUS_TO_CODE: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
};

function isPrismaKnownError(exception: unknown): exception is { code: string } {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    typeof (exception as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((exception as { code: string }).code)
  );
}

function mapPrismaError(code: string): NormalizedError | null {
  switch (code) {
    case 'P2002':
      return {
        statusCode: HttpStatus.CONFLICT,
        code: ERROR_CODES.CONFLICT,
        message: 'A conflicting record already exists.',
      };
    case 'P2003':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Referenced resource does not exist.',
      };
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Requested record was not found.',
      };
    default:
      return null;
  }
}

function mapHttpException(exception: HttpException): NormalizedError {
  const statusCode = exception.getStatus();
  const payload = exception.getResponse();
  const fallbackCode = HTTP_STATUS_TO_CODE[statusCode] ?? ERROR_CODES.INTERNAL_ERROR;

  if (typeof payload === 'string') {
    return { statusCode, code: fallbackCode, message: payload };
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    const rawMessage = record.message;
    const isValidationArray = Array.isArray(rawMessage);
    const message = isValidationArray
      ? 'Request validation failed.'
      : typeof rawMessage === 'string'
        ? rawMessage
        : exception.message;

    return {
      statusCode,
      code: typeof record.code === 'string' ? record.code : fallbackCode,
      message,
      ...(isValidationArray ? { details: rawMessage } : {}),
    };
  }

  return { statusCode, code: fallbackCode, message: exception.message };
}

/** Normalizes all unhandled exceptions into the canonical Aashvo error envelope without leaking stack traces. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const requestId =
      request.requestId ?? resolveRequestId(request.headers?.['x-request-id']);
    response.setHeader('X-Request-ID', requestId);

    const normalized = this.normalizeException(exception);
    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled internal error on ${request.method} ${request.url} [${requestId}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorResponse = {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details !== undefined ? { details: normalized.details } : {}),
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(normalized.statusCode).json(body);
  }

  private normalizeException(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return mapHttpException(exception);
    }

    if (isPrismaKnownError(exception)) {
      const mapped = mapPrismaError(exception.code);
      if (mapped) {
        return mapped;
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected internal error occurred.',
    };
  }
}

