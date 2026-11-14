import { Writable } from 'node:stream';
import pino from 'pino';
import {
  buildPinoParams,
  SENSITIVE_LOG_PATHS,
} from '../src/infrastructure/observability/logger.config';

describe('Structured Logger PII & Secret Redaction', () => {
  test('redacts authorization headers, cookies, passwords, hashes, OTPs, tokens, and phone numbers', () => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString('utf8'));
        callback();
      },
    });

    const logger = pino(
      {
        level: 'info',
        redact: {
          paths: SENSITIVE_LOG_PATHS,
          censor: '[Redacted]',
        },
      },
      sink,
    );

    logger.info({
      event: 'auth_attempt',
      req: {
        headers: {
          authorization: 'Bearer eyJsecret.jwt.token',
          cookie: '__Host-aashvo_rt=secret_refresh_token',
        },
      },
      payload: {
        password: 'PlainPassword123!',
        passwordHash: '$2b$10$abcdef...',
        otp: '482910',
        refreshToken: 'rt_secret_xyz',
        phoneNumber: '+919810112233',
      },
      res: {
        headers: {
          'set-cookie': '__Host-aashvo_rt=rotated_secret',
        },
      },
    });

    const serialized = chunks.join('');
    expect(serialized).not.toContain('eyJsecret.jwt.token');
    expect(serialized).not.toContain('secret_refresh_token');
    expect(serialized).not.toContain('PlainPassword123!');
    expect(serialized).not.toContain('$2b$10$abcdef');
    expect(serialized).not.toContain('482910');
    expect(serialized).not.toContain('rt_secret_xyz');
    expect(serialized).not.toContain('+919810112233');
    expect(serialized).not.toContain('rotated_secret');
    expect(serialized).toContain('[Redacted]');
  });

  test('disables pino-pretty transport in production and ignores liveness probe access noise', () => {
    const prodParams = buildPinoParams({ environment: 'production', logLevel: 'info' });
    const httpOpts = prodParams.pinoHttp as {
      transport?: unknown;
      autoLogging?: { ignore: (req: { url?: string }) => boolean };
    };

    expect(httpOpts.transport).toBeUndefined();
    expect(httpOpts.autoLogging?.ignore({ url: '/api/v1/health/live' })).toBe(true);
    expect(httpOpts.autoLogging?.ignore({ url: '/api/v1/health/ready' })).toBe(false);
  });
});

