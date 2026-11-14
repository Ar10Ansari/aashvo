import type { DependencyCheckResult } from '@aashvo/contracts';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../config/env.schema';

const HEALTH_PROBE_TIMEOUT_MS = 2500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL', { infer: true }),
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch((err: unknown) => {
      this.logger.warn(
        `Error during Prisma disconnect: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    });
  }

  /**
   * Executes a real SQL liveness check (`SELECT 1`) against PostgreSQL.
   * Never fakes readiness when no database is reachable.
   */
  async checkDatabaseHealth(): Promise<DependencyCheckResult> {
    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.$queryRawUnsafe('SELECT 1'),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Database probe timed out')), HEALTH_PROBE_TIMEOUT_MS);
        }),
      ]);

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: 'Database unavailable',
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

