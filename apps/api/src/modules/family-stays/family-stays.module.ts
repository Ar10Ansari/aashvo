import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { FamilyStaysController } from './family-stays.controller';
import { FamilyStaysService } from './family-stays.service';

@Module({
  imports: [PrismaModule],
  controllers: [FamilyStaysController],
  providers: [FamilyStaysService],
  exports: [FamilyStaysService],
})
export class FamilyStaysModule {}

