import { Module } from '@nestjs/common';
import { OperationalNotesController } from './operational-notes.controller';
import { OperationalNotesService } from './operational-notes.service';
import { SecurityModule } from '../../security/security.module';

/**
 * PHASE 3 STEP 3.5 — Operational Notes Module
 *
 * Cross-domain operational infrastructure: notes for Customer, Partner,
 * Order, Booking, Payment, Refund, Product, Fulfillment, Reservation,
 * BuyerRequest, PartnerApplication.
 *
 * Round 2B: API endpoints with RBAC + audit.
 */
@Module({
  imports: [SecurityModule],
  controllers: [OperationalNotesController],
  providers: [OperationalNotesService],
  exports: [OperationalNotesService],
})
export class OperationalNotesModule {}
