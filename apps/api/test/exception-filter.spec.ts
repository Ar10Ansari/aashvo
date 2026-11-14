import { ERROR_CODES } from '@aashvo/contracts';
import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

interface MockResponseState {
  statusCode: number;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
}

function createHttpHost(requestId?: string): {
  host: ArgumentsHost;
  state: MockResponseState;
} {
  const state: MockResponseState = {
    statusCode: 0,
    body: null,
    headers: {},
  };

  const request = {
    method: 'POST',
    url: '/api/v1/test',
    requestId,
    headers: {},
  };

  const response: {
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  } = {
    setHeader: jest.fn((key: string, value: string) => {
      state.headers[key] = value;
    }),
    status: jest.fn((code: number) => {
      state.statusCode = code;
      return response;
    }),
    json: jest.fn((payload: Record<string, unknown>) => {
      state.body = payload;
      return response;
    }),
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, state };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  test('formats validation array errors with VALIDATION_FAILED code and preserves requestId', () => {
    const { host, state } = createHttpHost('req_validation_123');
    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(state.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(state.headers['X-Request-ID']).toBe('req_validation_123');
    expect(state.body).toMatchObject({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Request validation failed.',
        details: ['email must be an email'],
        requestId: 'req_validation_123',
      },
    });
  });

  test('maps Prisma unique constraint error P2002 to HTTP 409 CONFLICT without leaking internals', () => {
    const { host, state } = createHttpHost('req_p2002');
    filter.catch({ code: 'P2002', meta: { target: ['users_email_key'] } }, host);

    expect(state.statusCode).toBe(HttpStatus.CONFLICT);
    expect(state.body).toMatchObject({
      error: {
        code: ERROR_CODES.CONFLICT,
        message: 'A conflicting record already exists.',
        requestId: 'req_p2002',
      },
    });
    expect(JSON.stringify(state.body)).not.toContain('users_email_key');
  });

  test('maps Prisma P2025 to HTTP 404 NOT_FOUND and masks unhandled Error stack traces', () => {
    const p2025 = createHttpHost('req_p2025');
    filter.catch({ code: 'P2025' }, p2025.host);
    expect(p2025.state.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(p2025.state.body).toMatchObject({
      error: { code: ERROR_CODES.NOT_FOUND },
    });

    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const crash = createHttpHost('req_crash');
      filter.catch(new Error('postgres://secret-user:secret-pw@db:5432 failed'), crash.host);
      expect(crash.state.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(crash.state.body).toMatchObject({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'An unexpected internal error occurred.',
          requestId: 'req_crash',
        },
      });
      expect(JSON.stringify(crash.state.body)).not.toContain('secret-pw');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('preserves custom HttpException error codes', () => {
    const { host, state } = createHttpHost('req_custom');
    filter.catch(
      new ConflictException({ code: 'DUPLICATE_DISPUTE', message: 'Active dispute exists.' }),
      host,
    );

    expect(state.statusCode).toBe(HttpStatus.CONFLICT);
    expect(state.body).toMatchObject({
      error: {
        code: 'DUPLICATE_DISPUTE',
        message: 'Active dispute exists.',
      },
    });
  });
});

