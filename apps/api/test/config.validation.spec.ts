import { generateKeyPairSync } from 'node:crypto';
import { validateEnv } from '../src/infrastructure/config/env.schema';

const rsaPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function createValidBaseEnv(overrides: Record<string, string> = {}): Record<string, unknown> {
  return {
    NODE_ENV: 'development',
    PORT: '4000',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:secret_local_pw_999@localhost:5433/aashvo_dev',
    JWT_SIGNING_PRIVATE_KEY: rsaPair.privateKey,
    JWT_SIGNING_PUBLIC_KEY: rsaPair.publicKey,
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173,https://aashvo.vercel.app',
    TRUST_PROXY: 'false',
    ...overrides,
  };
}

describe('Environment Configuration Validation', () => {
  test('accepts valid complete configuration and transforms CORS origins into an array', () => {
    const config = validateEnv(createValidBaseEnv());

    expect(config.PORT).toBe(4000);
    expect(config.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(config.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(config.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://aashvo.vercel.app',
    ]);
    expect(config.TRUST_PROXY).toBe(false);
  });

  test('rejects missing mandatory DATABASE_URL and JWT signing keys without printing secret values', () => {
    const sentinel = 'SUPER_SECRET_SENTINEL_1234567890_DO_NOT_LOG';
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SIGNING_PRIVATE_KEY: sentinel,
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
      }),
    ).toThrow(/DATABASE_URL/);

    try {
      validateEnv({
        NODE_ENV: 'development',
        JWT_SIGNING_PRIVATE_KEY: sentinel,
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
      });
    } catch (err) {
      expect((err as Error).message).toContain('JWT_SIGNING_PUBLIC_KEY');
      expect((err as Error).message).not.toContain(sentinel);
    }
  });

  test('rejects non-RSA signing keys and non-postgres DATABASE_URL schemes', () => {
    expect(() =>
      validateEnv(
        createValidBaseEnv({
          DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
          JWT_SIGNING_PRIVATE_KEY: 'not-a-valid-rsa-pem-even-though-long-enough-here',
        }),
      ),
    ).toThrow(/DATABASE_URL.*postgresql:\/\/.*JWT_SIGNING_PRIVATE_KEY/s);
  });

  test('forbids wildcard "*" in CORS_ALLOWED_ORIGINS when credentials are enabled', () => {
    expect(() =>
      validateEnv(
        createValidBaseEnv({
          CORS_ALLOWED_ORIGINS: '*',
        }),
      ),
    ).toThrow(/CORS_ALLOWED_ORIGINS: wildcard "\*" is forbidden/);
  });

  test('forbids placeholder DB credentials in production and staging', () => {
    expect(() =>
      validateEnv(
        createValidBaseEnv({
          NODE_ENV: 'staging',
          DATABASE_URL: 'postgresql://postgres:CHANGE_ME_LOCAL_ONLY@db.internal:5432/aashvo',
        }),
      ),
    ).toThrow(/placeholder database credentials are forbidden/);
  });

  test('rejects unsafe blind TRUST_PROXY=true values', () => {
    expect(() =>
      validateEnv(
        createValidBaseEnv({
          TRUST_PROXY: 'true',
        }),
      ),
    ).toThrow(/TRUST_PROXY/);
  });
});
