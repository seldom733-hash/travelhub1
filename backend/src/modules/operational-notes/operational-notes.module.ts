import { Module } from '@nestjs/common';
import { OperationalNotesService } from './operational-notes.service';

/**
 * PHASE 3 STEP 3.5 — Operational Notes Module
 *
 * Cross-domain operational infrastructure: notes for Customer, Partner,
 * Order, Booking, Payment, Refund, Product, Fulfillment, Reservation,
 * BuyerRequest, PartnerApplication.
 *
 * No controller in Round 2A. API endpoints arrive in Round 2B.
 */
@Module({
  providers: [OperationalNotesService],
  exports: [OperationalNotesService],
})
export class OperationalNotesModule {}
