import { generateKeyPairSync } from 'node:crypto';

const testRsaKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL ??= 'postgresql://postgres@127.0.0.1:5433/aashvo_test';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.JWT_SIGNING_PRIVATE_KEY = testRsaKeys.privateKey;
process.env.JWT_SIGNING_PUBLIC_KEY = testRsaKeys.publicKey;
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.TRUST_PROXY = 'false';
process.env.COOKIE_SECURE = 'false';
