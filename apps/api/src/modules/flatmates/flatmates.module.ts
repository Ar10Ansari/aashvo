import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FlatmatesController } from './flatmates.controller';
import { FlatmatesService } from './flatmates.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FlatmatesController],
  providers: [FlatmatesService],
  exports: [FlatmatesService],
})
export class FlatmatesModule {}

