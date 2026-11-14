import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { STORAGE_PORT } from './ports/storage.port';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalStorageAdapter,
    {
      provide: STORAGE_PORT,
      useExisting: LocalStorageAdapter,
    },
  ],
  exports: [MediaService, STORAGE_PORT],
})
export class MediaModule {}

