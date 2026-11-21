import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SafetyReportsController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupportController, SafetyReportsController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}

