import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppEnvironment } from '../config/env.schema';
import { resolveRequestId } from '../../common/interceptors/request-id.interceptor';

export const SENSITIVE_LOG_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.encrypted_password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.otp',
  '*.otpCode',
  '*.phoneNumber',
  '*.secret',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'phoneNumber',
  'secret',
];

export function buildPinoParams(options: {
  environment: AppEnvironment;
  logLevel: string;
}): Params {
  const isDev = options.environment === 'development';
  return {
    pinoHttp: {
      level: options.environment === 'test' ? 'silent' : options.logLevel,
      redact: {
        paths: SENSITIVE_LOG_PATHS,
        censor: '[Redacted]',
      },
      genReqId: (req: IncomingMessage) => resolveRequestId(req.headers['x-request-id']),
      customProps: (req: IncomingMessage) => ({
        requestId: (req as IncomingMessage & { id?: string }).id,
      }),
      customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/api/v1/health/live',
      },
      ...(isDev
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'SYS:standard',
              },
            },
          }
        : {}),
    },
  };
}

