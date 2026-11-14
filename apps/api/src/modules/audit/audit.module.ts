import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface AuditRecordInput {
  actorId?: string | null;
  actorRole?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  outcome: 'success' | 'denied' | 'failure';
  ipAddress?: string | null;
  requestId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes an append-only security/business audit entry; accepts an optional transaction client. */
  async record(
    input: AuditRecordInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        outcome: input.outcome,
        ipAddress: input.ipAddress ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }
}

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

