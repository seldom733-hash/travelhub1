import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { VoucherConsumer } from "./voucher.consumer";
import { RefundDocumentConsumer } from "./refund-document.consumer";
import { InvalidationConsumer } from "./invalidation.consumer";
import { DocumentRenderer } from "./document-renderer.service";
import { S3ObjectStorageService } from "../catalog/media/storage/s3-storage.service";

/**
 * DocumentsModule — D13 Voucher + Partial Payment Document + Refund Document.
 *
 * Canonical contract: Documents owns Voucher. Source: Booking → Passengers.
 * Lifecycle: NOT_ISSUED → ISSUED → SUPERSEDED | INVALIDATED.
 */
@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    VoucherConsumer,
    RefundDocumentConsumer,
    InvalidationConsumer,
    DocumentRenderer,
    { provide: "ObjectStorageService", useClass: S3ObjectStorageService },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
