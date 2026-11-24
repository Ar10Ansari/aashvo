import { createPrivateKey, createPublicKey } from 'node:crypto';
import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'staging', 'production'] as const;
export type AppEnvironment = (typeof NODE_ENVS)[number];

const PLACEHOLDER_MARKER = /(REPLACE_WITH|CHANGE_ME|EXAMPLE_SECRET)/i;

function parseCorsOrigins(raw: string, ctx: z.RefinementCtx): string[] {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must include at least one explicit origin URL',
    });
    return z.NEVER;
  }

  for (const origin of origins) {
    if (origin === '*') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'wildcard "*" is forbidden when credentialed CORS is enabled',
      });
      return z.NEVER;
    }

    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Invalid scheme');
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'every origin must be a valid http:// or https:// URL',
      });
      return z.NEVER;
    }
  }

  return origins;
}

function normalizeMultilinePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

function validateRsaPrivatePem(raw: string, ctx: z.RefinementCtx): string {
  const normalized = normalizeMultilinePem(raw);
  try {
    const key = createPrivateKey(normalized);
    if (key.asymmetricKeyType !== 'rsa') {
      throw new Error('Expected RSA private key');
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must be a valid RSA PEM private key for RS256 JWT signing',
    });
    return z.NEVER;
  }
  return normalized;
}

function validateRsaPublicPem(raw: string, ctx: z.RefinementCtx): string {
  const normalized = normalizeMultilinePem(raw);
  try {
    const key = createPublicKey(normalized);
    if (key.asymmetricKeyType !== 'rsa') {
      throw new Error('Expected RSA public key');
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must be a valid RSA PEM public key for RS256 JWT verification',
    });
    return z.NEVER;
  }
  return normalized;
}

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    ENABLE_SWAGGER: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    DATABASE_URL: z
      .string()
      .trim()
      .min(1, 'is required')
      .refine(
        (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
        'must use postgresql:// or postgres:// scheme',
      ),
    DIRECT_URL: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => val === undefined || val.startsWith('postgresql://') || val.startsWith('postgres://'),
        'must use postgresql:// or postgres:// scheme',
      ),
    JWT_SIGNING_PRIVATE_KEY: z
      .string()
      .trim()
      .min(32, 'is required')
      .transform(validateRsaPrivatePem),
    JWT_SIGNING_PUBLIC_KEY: z
      .string()
      .trim()
      .min(32, 'is required')
      .transform(validateRsaPublicPem),
    JWT_ISSUER: z.string().trim().min(1).default('https://api.aashvo.in'),
    JWT_AUDIENCE: z.string().trim().min(1).default('aashvo-clients'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
    WEB_APP_URL: z.string().url().default('http://localhost:5173'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .trim()
      .min(1, 'is required')
      .transform(parseCorsOrigins),
    TRUST_PROXY: z
      .enum(['false', 'loopback', '1', '2', '3'])
      .default('false')
      .transform((val): false | 'loopback' | number => {
        if (val === 'false') return false;
        if (val === 'loopback') return 'loopback';
        return Number(val);
      }),
    THROTTLE_TTL_MS: z.coerce.number().int().min(1000).default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(120),
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    STORAGE_PROVIDER: z.enum(['local', 'cloud']).default('local'),
    LOCAL_STORAGE_BASE_DIR: z.string().default('./scratch/storage'),
    LOCAL_STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:4000/assets'),
    CLOUDFLARE_R2_ACCOUNT_ID: z.string().trim().optional(),
    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().trim().optional(),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().trim().optional(),
    CLOUDFLARE_R2_BUCKET_NAME: z.string().trim().default('aashvo-public-assets'),
    CLOUDFLARE_R2_PUBLIC_URL: z.string().trim().default('https://assets.aashvo.in'),
    AWS_REGION: z.string().trim().default('ap-south-1'),
    AWS_S3_PRIVATE_BUCKET: z.string().trim().default('aashvo-private-vault'),
    AWS_ACCESS_KEY_ID: z.string().trim().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().trim().optional(),
  })
  .superRefine((cfg, ctx) => {
    const isHostedEnv = cfg.NODE_ENV === 'production' || cfg.NODE_ENV === 'staging';
    if (!isHostedEnv) {
      return;
    }

    if (cfg.STORAGE_PROVIDER === 'cloud') {
      if (!cfg.CLOUDFLARE_R2_ACCOUNT_ID || !cfg.CLOUDFLARE_R2_ACCESS_KEY_ID || !cfg.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDFLARE_R2_ACCESS_KEY_ID'],
          message: 'Cloudflare R2 credentials are required when STORAGE_PROVIDER=cloud',
        });
      }
      if (!cfg.AWS_ACCESS_KEY_ID || !cfg.AWS_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AWS_ACCESS_KEY_ID'],
          message: 'AWS S3 credentials are required when STORAGE_PROVIDER=cloud',
        });
      }
    }

    if (PLACEHOLDER_MARKER.test(cfg.DATABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'placeholder database credentials are forbidden in staging/production',
      });
    }

    if (cfg.DIRECT_URL && PLACEHOLDER_MARKER.test(cfg.DIRECT_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DIRECT_URL'],
        message: 'placeholder database credentials are forbidden in staging/production',
      });
    }
  });

export type AppConfig = z.infer<typeof rawEnvSchema>;

/** Validates process environment variables without printing any secret values on failure. */
export function validateEnv(config: Record<string, unknown>): AppConfig {
  const result = rawEnvSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'ENV';
      return `${key}: ${issue.message}`;
    });
    throw new Error(`Invalid backend configuration:\n- ${issues.join('\n- ')}`);
  }

  return result.data;
}
