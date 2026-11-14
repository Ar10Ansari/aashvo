import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConnectController } from './connect.controller';
import { ConnectService } from './connect.service';

@Module({
  imports: [AuditModule],
  controllers: [ConnectController],
  providers: [ConnectService],
  exports: [ConnectService],
})
export class ConnectModule {}

