const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AUTHORIZED_DIRECT_HOST = 'ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech';
const AUTHORIZED_POOLED_HOST = 'ep-snowy-hall-bi49p4m9-pooler.c-5.ap-southeast-1.aws.neon.tech';
const AUTHORIZED_DB_NAME = '/aashvo_staging';
const AUTHORIZED_ROLE = 'aashvo_staging_owner';
const VALID_ACTIONS = new Set(['status', 'deploy']);

// 1. Validate invocation arguments fail-closed
const action = process.argv[2];
if (!action) {
  console.error('FATAL: Action argument missing. Usage: node verify-and-migrate-neon.cjs <status|deploy>');
  process.exit(1);
}

if (!VALID_ACTIONS.has(action)) {
  console.error(`FATAL: Unauthorized action "${action}". Allowed actions are strictly: ${Array.from(VALID_ACTIONS).join(', ')}`);
  process.exit(1);
}

// 2. Load and parse .env.neon configuration
const envPath = path.resolve(__dirname, '../.env.neon');
if (!fs.existsSync(envPath)) {
  console.error(`FATAL: Staging environment file not found at: ${envPath}`);
  process.exit(1);
}

const fileContent = fs.readFileSync(envPath, 'utf8');
const fileEnv = {};
for (const line of fileContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fileEnv[match[1]] = val;
  }
}

// Fail closed on missing parameters
const directUrl = fileEnv.DIRECT_URL;
const databaseUrl = fileEnv.DATABASE_URL;

if (!directUrl || !databaseUrl) {
  console.error('FATAL: Both DIRECT_URL and DATABASE_URL must be defined in .env.neon');
  process.exit(1);
}

// 3. Strict URL validation function
function validateStagingUrl(urlString, label, expectedHost) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    console.error(`FATAL: Malformed ${label} URL: ${err.message}`);
    process.exit(1);
  }

  // Require PostgreSQL protocol
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    console.error(`FATAL: Invalid protocol "${parsed.protocol}" for ${label}. Must be "postgresql:" or "postgres:".`);
    process.exit(1);
  }

  // Strictly validate exact authorized hostname
  if (parsed.hostname !== expectedHost) {
    console.error(`FATAL: Unauthorized ${label} hostname "${parsed.hostname}". Expected exact host: "${expectedHost}".`);
    process.exit(1);
  }

  // Strictly validate database name
  if (parsed.pathname !== AUTHORIZED_DB_NAME) {
    console.error(`FATAL: Unauthorized ${label} database "${parsed.pathname}". Expected exact database: "${AUTHORIZED_DB_NAME}".`);
    process.exit(1);
  }

  // Validate staging role
  if (parsed.username !== AUTHORIZED_ROLE) {
    console.error(`FATAL: Unauthorized ${label} role "${parsed.username}". Expected exact role: "${AUTHORIZED_ROLE}".`);
    process.exit(1);
  }

  return parsed;
}

console.log('--- SAFETY GATE CHECK ---');
const parsedDirect = validateStagingUrl(directUrl, 'DIRECT_URL', AUTHORIZED_DIRECT_HOST);
const parsedPooled = validateStagingUrl(databaseUrl, 'DATABASE_URL', AUTHORIZED_POOLED_HOST);

console.log('Target Protocol:  ', parsedDirect.protocol);
console.log('Direct Compute:   ', parsedDirect.hostname);
console.log('Pooled Compute:   ', parsedPooled.hostname);
console.log('Target Database:  ', parsedDirect.pathname);
console.log('Database Role:    ', parsedDirect.username);
console.log('SAFETY AUDIT: All parameters verified against authorized Neon staging.');
console.log('-------------------------');

// 4. Prevent process environment variables from silently overriding staging target
const cleanEnv = {
  ...process.env,
  ...fileEnv,
  DIRECT_URL: directUrl,
  DATABASE_URL: databaseUrl,
};

// Re-verify that execution environment carries the exact validated URLs
if (cleanEnv.DIRECT_URL !== directUrl || cleanEnv.DATABASE_URL !== databaseUrl) {
  console.error('FATAL: Environment tampering detected. Execution environment does not match validated URLs.');
  process.exit(1);
}

// 5. Execute approved action
const prismaSchema = path.resolve(__dirname, '../prisma/schema.prisma');
if (!fs.existsSync(prismaSchema)) {
  console.error(`FATAL: Prisma schema not found at: ${prismaSchema}`);
  process.exit(1);
}

if (action === 'status') {
  console.log('Executing safe Prisma migration status check on Neon staging...');
  const out = execSync(`npx prisma migrate status --schema="${prismaSchema}"`, {
    cwd: path.resolve(__dirname, '..'),
    env: cleanEnv,
    encoding: 'utf8'
  });
  console.log(out);
} else if (action === 'deploy') {
  console.log('Executing safe Prisma migration deploy on Neon staging...');
  const out = execSync(`npx prisma migrate deploy --schema="${prismaSchema}"`, {
    cwd: path.resolve(__dirname, '..'),
    env: cleanEnv,
    encoding: 'utf8'
  });
  console.log(out);
}
