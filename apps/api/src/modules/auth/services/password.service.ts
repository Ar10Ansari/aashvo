import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

const ARGON2_HASH_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  raw: false,
};

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('aashvo-timing-equalizer-sentinel', ARGON2_HASH_OPTIONS);
  }

  async hashPassword(plainText: string): Promise<string> {
    return argon2.hash(plainText, ARGON2_HASH_OPTIONS);
  }

  async verifyPassword(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }

  /** Performs a constant-cost Argon2id verify when no account exists to reduce email timing oracles. */
  async consumeDummyVerify(plainText: string): Promise<void> {
    if (!this.dummyHash) {
      this.dummyHash = await argon2.hash(
        'aashvo-timing-equalizer-sentinel',
        ARGON2_HASH_OPTIONS,
      );
    }
    await argon2.verify(this.dummyHash, plainText).catch(() => false);
  }
}
