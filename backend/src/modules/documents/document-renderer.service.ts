import { Injectable, Logger } from "@nestjs/common";
import { pdf, Document } from "@react-pdf/renderer";
import React from "react";
import type { DocumentType } from "../../generated/prisma/client";
import { VoucherTemplate } from "./templates/voucher.template";
import { PartialPaymentTemplate } from "./templates/partial-payment.template";
import { RefundTemplate } from "./templates/refund.template";
import type { VoucherData } from "./templates/voucher.template";
import type { PartialPaymentData } from "./templates/partial-payment.template";
import type { RefundData } from "./templates/refund.template";

/**
 * DocumentRenderer — renders document data to real PDF using @react-pdf/renderer.
 *
 * PII must be redacted BEFORE calling render().
 * Produces valid PDF binary with proper header, A4 layout, and styled content.
 * Uses TSX templates (AD-D13-12/13) as the production rendering engine.
 */
@Injectable()
export class DocumentRenderer {
  private readonly logger = new Logger(DocumentRenderer.name);

  async render(type: DocumentType, snapshot: Record<string, unknown>): Promise<Buffer> {
    let element: React.ReactElement;

    switch (type) {
      case "VOUCHER":
        element = React.createElement(VoucherTemplate, { data: snapshot as unknown as VoucherData });
        break;
      case "PARTIAL_PAYMENT":
        element = React.createElement(PartialPaymentTemplate, { data: snapshot as unknown as PartialPaymentData });
        break;
      case "REFUND":
        element = React.createElement(RefundTemplate, { data: snapshot as unknown as RefundData });
        break;
      default:
        throw new Error(`Unknown document type: ${type}`);
    }

    const doc = React.createElement(Document, null, element);
    const blob = await pdf(doc).toBlob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    if (buffer.length === 0 || !buffer.slice(0, 5).toString("ascii").startsWith("%PDF")) {
      throw new Error(`Invalid PDF produced for ${type}`);
    }

    this.logger.debug(`Rendered ${type} PDF: ${buffer.length} bytes`);
    return buffer;
  }
}
