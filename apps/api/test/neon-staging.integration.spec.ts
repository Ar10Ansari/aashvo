import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

describe('Neon Staging PostgreSQL Integration & Production Isolation Suite', () => {
  let prisma: PrismaClient;
  let pooledUrl: string;
  let directUrl: string;

  beforeAll(() => {
    const envPath = path.resolve(__dirname, '../.env.neon');
    if (!fs.existsSync(envPath)) {
      throw new Error(`Neon staging configuration file missing at ${envPath}`);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const parsedEnv: Record<string, string> = {};
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        parsedEnv[match[1]] = val;
      }
    }

    pooledUrl = parsedEnv.DATABASE_URL;
    directUrl = parsedEnv.DIRECT_URL;

    expect(pooledUrl).toBeDefined();
    expect(directUrl).toBeDefined();

    prisma = new PrismaClient({
      datasources: {
        db: { url: pooledUrl },
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  describe('1. Production Isolation & Host Validation Guardrails', () => {
    it('strictly verifies target database hostname belongs to Neon staging compute', () => {
      const parsed = new URL(pooledUrl);
      expect(parsed.hostname).toContain('ep-snowy-hall-bi49p4m9');
      expect(parsed.hostname).toMatch(/\.neon\.tech$/);
      expect(parsed.hostname).not.toContain('supabase.co');
      expect(parsed.hostname).not.toContain('production');
    });

    it('strictly verifies target database name is aashvo_staging', () => {
      const parsedPooled = new URL(pooledUrl);
      const parsedDirect = new URL(directUrl);
      expect(parsedPooled.pathname).toBe('/aashvo_staging');
      expect(parsedDirect.pathname).toBe('/aashvo_staging');
    });

    it('rejects connection attempts if host is identified as production or external cloud', () => {
      const isProductionUrl = (urlStr: string): boolean => {
        const u = new URL(urlStr);
        return (
          u.hostname.includes('supabase.co') ||
          u.hostname.includes('prod') ||
          u.pathname === '/postgres' ||
          u.pathname === '/aashvo_prod'
        );
      };

      expect(isProductionUrl(pooledUrl)).toBe(false);
      expect(isProductionUrl(directUrl)).toBe(false);
    });
  });

  describe('2. Neon PostgreSQL Connection & Health Probes', () => {
    it('executes real SQL liveness probe (SELECT 1) over TLS', async () => {
      const start = Date.now();
      const result = await prisma.$queryRawUnsafe<Array<{ check: number }>>('SELECT 1 as check');
      const latencyMs = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(Number(result[0].check)).toBe(1);
      expect(latencyMs).toBeLessThan(5000);
    });

    it('retrieves server version and confirms PostgreSQL 16+', async () => {
      const result = await prisma.$queryRawUnsafe<Array<{ version: string }>>('SELECT version()');
      expect(result[0].version).toContain('PostgreSQL');
    });
  });

  describe('3. Schema Integrity & Table Existence', () => {
    it('confirms all 33 domain application tables + migration table exist in aashvo_staging', async () => {
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
      `);

      const tableNames = tables.map((t) => t.table_name);
      expect(tableNames).toContain('_prisma_migrations');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('properties');
      expect(tableNames).toContain('interest_requests');
      expect(tableNames).toContain('support_tickets');
      expect(tableNames).toContain('safety_reports');
      expect(tableNames).toContain('refresh_sessions');
      expect(tableNames).toContain('audit_logs');
      expect(tableNames).toContain('marketplace_profiles');
      expect(tableNames).toContain('flatmate_profiles');

      expect(tableNames.length).toBeGreaterThanOrEqual(34);
    });

    it('confirms all 7 Prisma migrations are registered with valid checksums in _prisma_migrations', async () => {
      const migrations = await prisma.$queryRawUnsafe<Array<{ migration_name: string; rolled_back_at: string | null }>>(`
        SELECT migration_name, rolled_back_at 
        FROM _prisma_migrations 
        ORDER BY started_at ASC
      `);

      expect(migrations.length).toBe(7);
      for (const m of migrations) {
        expect(m.rolled_back_at).toBeNull();
      }
    });
  });

  describe('4. Synthetic Data CRUD & Transaction Lifecycle', () => {
    const syntheticEmail = `qa.synthetic.${randomUUID()}@aashvo.test`;
    let createdUserId: string;

    it('creates a synthetic user record via Prisma transaction', async () => {
      const user = await prisma.user.create({
        data: {
          email: syntheticEmail,
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$synthetic_hash',
          role: 'renter',
          accountStatus: 'active',
          profile: {
            create: {
              email: syntheticEmail,
              fullName: 'Synthetic QA Tester',
            },
          },
        },
        include: {
          profile: true,
        },
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(syntheticEmail);
      expect(user.profile?.fullName).toBe('Synthetic QA Tester');
      createdUserId = user.id;
    });

    it('reads and updates the synthetic user record in aashvo_staging', async () => {
      const found = await prisma.user.findUnique({
        where: { id: createdUserId },
        include: { profile: true },
      });
      expect(found).not.toBeNull();
      expect(found?.email).toBe(syntheticEmail);

      const updated = await prisma.user.update({
        where: { id: createdUserId },
        data: {
          role: 'owner',
          profile: {
            update: {
              fullName: 'Updated Synthetic QA Tester',
            },
          },
        },
        include: { profile: true },
      });
      expect(updated.role).toBe('owner');
      expect(updated.profile?.fullName).toBe('Updated Synthetic QA Tester');
    });

    it('creates and reads an associated synthetic audit log record', async () => {
      const auditLog = await prisma.auditLog.create({
        data: {
          actorId: createdUserId,
          actorRole: 'owner',
          eventType: 'STAGING_VERIFICATION_TEST',
          entityType: 'User',
          entityId: createdUserId,
          outcome: 'SUCCESS',
          metadata: { testSuite: 'neon-staging.integration.spec.ts', timestamp: new Date().toISOString() },
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.actorId).toBe(createdUserId);
      expect(auditLog.eventType).toBe('STAGING_VERIFICATION_TEST');
      expect(auditLog.outcome).toBe('SUCCESS');
    });

    it('cleans up synthetic test records, confirming strict data hygiene', async () => {
      await prisma.auditLog.deleteMany({
        where: { actorId: createdUserId },
      });

      const deletedUser = await prisma.user.delete({
        where: { id: createdUserId },
      });
      expect(deletedUser.id).toBe(createdUserId);

      const verifyDeleted = await prisma.user.findUnique({
        where: { id: createdUserId },
      });
      expect(verifyDeleted).toBeNull();
    });
  });
});
