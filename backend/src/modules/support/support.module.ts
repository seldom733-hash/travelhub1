import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

/**
 * PHASE 3 STEP 3.10 — Support Domain Module.
 *
 * Canonical support case/ticket management.
 * Uses Prisma support schema (support.Case, support.CaseComment, etc.).
 */
@Module({
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
