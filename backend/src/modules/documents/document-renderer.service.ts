import { Injectable, Logger } from "@nestjs/common";
import type { DocumentType } from "../../generated/prisma/client";

/**
 * DocumentRenderer — renders document data to PDF using @react-pdf/renderer.
 *
 * D13 V1: Uses a simplified HTML-to-buffer approach.
 * Templates are defined as React components in ./templates/.
 */
@Injectable()
export class DocumentRenderer {
  private readonly logger = new Logger(DocumentRenderer.name);

  /**
   * Render a document type to PDF buffer.
   * D13 V1: Simplified text-based PDF (no @react-pdf/renderer yet).
   * TODO: Replace with @react-pdf/renderer once dependency is added.
   */
  async render(type: DocumentType, snapshot: Record<string, unknown>): Promise<Buffer> {
    // D13 V1: Generate a minimal PDF-like buffer for storage validation.
    // Real PDF rendering will use @react-pdf/renderer in a follow-up.
    const content = this.buildContent(type, snapshot);
    return Buffer.from(content, "utf-8");
  }

  private buildContent(type: DocumentType, snapshot: Record<string, unknown>): string {
    const lines: string[] = [];

    switch (type) {
      case "VOUCHER":
        lines.push("=== TRAVELHUB VOUCHER ===");
        lines.push("");
        lines.push(`Voucher: ${snapshot.code ?? "N/A"}`);
        lines.push(`Booking: ${snapshot.bookingCode ?? "N/A"}`);
        lines.push(`Order: ${snapshot.orderCode ?? "N/A"}`);
        lines.push(`Service: ${snapshot.serviceName ?? "N/A"}`);
        lines.push(`Date: ${snapshot.serviceDate ?? "N/A"}`);
        lines.push(`Total: ${snapshot.totalAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Paid: ${snapshot.paidAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Balance: 0.00 ${snapshot.currency ?? ""}`);
        lines.push(`Payment: ${snapshot.paymentStatus ?? "N/A"}`);
        lines.push("");
        lines.push("Travelers:");
        const travelers = snapshot.travelers as Array<Record<string, unknown>> | undefined;
        if (travelers) {
          for (const t of travelers) {
            lines.push(`  - ${t.firstName ?? ""} ${t.lastName ?? ""}`);
            if (t.birthDate) lines.push(`    DOB: ${t.birthDate}`);
            if (t.citizenship) lines.push(`    Citizenship: ${t.citizenship}`);
            if (t.passportNumber) lines.push(`    Passport: ${t.passportNumber}`);
          }
        }
        lines.push("");
        lines.push("This is a TravelHub platform confirmation document.");
        lines.push("It is NOT an airline ticket, hotel voucher, or supplier document.");
        break;

      case "PARTIAL_PAYMENT":
        lines.push("=== TRAVELHUB PARTIAL PAYMENT DOCUMENT ===");
        lines.push("");
        lines.push(`Document: ${snapshot.code ?? "N/A"}`);
        lines.push(`Booking: ${snapshot.bookingCode ?? "N/A"}`);
        lines.push(`Order: ${snapshot.orderCode ?? "N/A"}`);
        lines.push(`Service: ${snapshot.serviceName ?? "N/A"}`);
        lines.push(`Total: ${snapshot.totalAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Paid: ${snapshot.paidAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Remaining: ${snapshot.remainingAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Payment Status: ${snapshot.paymentStatus ?? "N/A"}`);
        break;

      case "REFUND":
        lines.push("=== TRAVELHUB REFUND DOCUMENT ===");
        lines.push("");
        lines.push(`Document: ${snapshot.code ?? "N/A"}`);
        lines.push(`Booking: ${snapshot.bookingCode ?? "N/A"}`);
        lines.push(`Order: ${snapshot.orderCode ?? "N/A"}`);
        lines.push(`Original Paid: ${snapshot.originalPaidAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Refund Amount: ${snapshot.refundAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Refunded Total: ${snapshot.refundedAmount ?? "N/A"} ${snapshot.currency ?? ""}`);
        lines.push(`Payment Status: ${snapshot.paymentStatus ?? "N/A"}`);
        lines.push(`Refund Date: ${snapshot.refundDate ?? "N/A"}`);
        break;
    }

    return lines.join("\n");
  }
}
