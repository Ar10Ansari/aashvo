import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export const MAIL_DISPATCH_PORT = Symbol('AASHVO_MAIL_DISPATCH_PORT');

export interface AuthEmailPayload {
  email: string;
  fullName: string;
  rawToken: string;
  expiresAt: Date;
  actionUrl: string;
}

export interface MailDispatchPort {
  sendVerificationEmail(payload: AuthEmailPayload): Promise<void>;
  sendPasswordResetEmail(payload: AuthEmailPayload): Promise<void>;
}

/**
 * Default Sprint 2 outbox recorder. Persists an audit-safe outbox entry without
 * storing plaintext verification/reset tokens inside the database or logs.
 */
@Injectable()
export class OutboxMailDispatchAdapter implements MailDispatchPort {
  constructor(private readonly prisma: PrismaService) {}

  async sendVerificationEmail(payload: AuthEmailPayload): Promise<void> {
    await this.prisma.notificationOutbox.create({
      data: {
        channel: 'email',
        templateKey: 'auth_email_verification',
        recipient: payload.email,
        payload: {
          fullName: payload.fullName,
          expiresAt: payload.expiresAt.toISOString(),
        },
        status: 'pending',
      },
    });
  }

  async sendPasswordResetEmail(payload: AuthEmailPayload): Promise<void> {
    await this.prisma.notificationOutbox.create({
      data: {
        channel: 'email',
        templateKey: 'auth_password_reset',
        recipient: payload.email,
        payload: {
          fullName: payload.fullName,
          expiresAt: payload.expiresAt.toISOString(),
        },
        status: 'pending',
      },
    });
  }
}

