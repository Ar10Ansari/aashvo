const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.resolve(__dirname, '../.env.neon');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.neon not found at ' + envPath);
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of content.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
}

const directUrl = env.DIRECT_URL;
if (!directUrl) {
  console.error('Error: DIRECT_URL missing in .env.neon');
  process.exit(1);
}

const parsed = new URL(directUrl);
console.log('--- SAFETY GATE CHECK ---');
console.log('Target Protocol:', parsed.protocol);
console.log('Target Hostname:', parsed.hostname);
console.log('Target Path (DB):', parsed.pathname);

// Strict safety checks
if (!parsed.hostname.includes('ep-snowy-hall-bi49p4m9') || !parsed.hostname.endsWith('neon.tech')) {
  console.error('FATAL SAFETY ABORT: Target hostname is not the authorized Neon staging compute!');
  process.exit(1);
}

if (parsed.pathname !== '/aashvo_staging') {
  console.error('FATAL SAFETY ABORT: Target database is not aashvo_staging!');
  process.exit(1);
}

console.log('SAFETY AUDIT: Host and Database confirmed to be Neon Staging.');
console.log('-------------------------');

const action = process.argv[2] || 'status';
const prismaSchema = path.resolve(__dirname, '../prisma/schema.prisma');

if (action === 'status') {
  console.log('Checking Prisma migration status on Neon staging...');
  const out = execSync(`npx prisma migrate status --schema="${prismaSchema}"`, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  console.log(out);
} else if (action === 'deploy') {
  console.log('Deploying Prisma migrations to Neon staging...');
  const out = execSync(`npx prisma migrate deploy --schema="${prismaSchema}"`, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  console.log(out);
}
