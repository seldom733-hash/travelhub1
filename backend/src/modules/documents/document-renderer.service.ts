import { Injectable, Logger } from "@nestjs/common";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentType } from "../../generated/prisma/client";

/**
 * DocumentRenderer — renders document data to real PDF using pdf-lib.
 *
 * PII must be redacted BEFORE calling render().
 * Produces valid PDF binary with proper header, fonts, and layout.
 */
@Injectable()
export class DocumentRenderer {
  private readonly logger = new Logger(DocumentRenderer.name);

  /**
   * Render a document type to PDF buffer.
   * @param type - Document type (VOUCHER, PARTIAL_PAYMENT, REFUND)
   * @param snapshot - Document data (PII must be pre-redacted)
   * @returns Non-empty Buffer with valid PDF content (%PDF-1.x header)
   */
  async render(type: DocumentType, snapshot: Record<string, unknown>): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    const contentWidth = width - 2 * margin;
    let y = height - margin;

    const colors = {
      primary: rgb(0.102, 0.337, 0.859),
      dark: rgb(0.067, 0.094, 0.176),
      gray: rgb(0.42, 0.45, 0.49),
      lightGray: rgb(0.85, 0.87, 0.89),
    };

    const drawLine = (yPos: number) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 1,
        color: colors.lightGray,
      });
    };

    const drawText = (text: string, xPos: number, yPos: number, opts: { font?: typeof font; size?: number; color?: typeof colors.dark } = {}) => {
      page.drawText(text, {
        x: xPos,
        y: yPos,
        font: opts.font ?? font,
        size: opts.size ?? 10,
        color: opts.color ?? colors.dark,
      });
    };

    const drawRow = (label: string, value: string, yPos: number) => {
      drawText(label, margin, yPos, { color: colors.gray });
      drawText(value, margin + 130, yPos, { font: boldFont });
      return yPos - 18;
    };

    switch (type) {
      case "VOUCHER":
        y = this.renderVoucher(pdfDoc, page, snapshot, { margin, contentWidth, y, font, boldFont, italicFont, colors, drawLine, drawText, drawRow });
        break;
      case "PARTIAL_PAYMENT":
        y = this.renderPartialPayment(pdfDoc, page, snapshot, { margin, contentWidth, y, font, boldFont, italicFont, colors, drawLine, drawText, drawRow });
        break;
      case "REFUND":
        y = this.renderRefund(pdfDoc, page, snapshot, { margin, contentWidth, y, font, boldFont, italicFont, colors, drawLine, drawText, drawRow });
        break;
      default:
        throw new Error(`Unknown document type: ${type}`);
    }

    // Footer
    drawLine(margin + 5);
    const footerY = margin;
    drawText("This document is a TravelHub platform confirmation.", margin, footerY + 20, { font: italicFont, size: 8, color: colors.gray });
    drawText("It is NOT an airline ticket, hotel voucher, or supplier document.", margin, footerY + 8, { font: italicFont, size: 8, color: colors.gray });

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    if (buffer.length === 0 || !buffer.slice(0, 5).toString("ascii").startsWith("%PDF")) {
      throw new Error(`Invalid PDF produced for ${type}`);
    }

    this.logger.debug(`Rendered ${type} PDF: ${buffer.length} bytes`);
    return buffer;
  }

  private renderVoucher(
    _pdfDoc: PDFDocument,
    _page: any,
    s: Record<string, unknown>,
    ctx: { margin: number; contentWidth: number; y: number; font: any; boldFont: any; italicFont: any; colors: any; drawLine: any; drawText: any; drawRow: any },
  ): number {
    let { y } = ctx;

    // Header
    ctx.drawText("TRAVELHUB VOUCHER", ctx.margin, y, { font: ctx.boldFont, size: 18, color: ctx.colors.primary });
    y -= 20;
    ctx.drawText("Platform Confirmation Document", ctx.margin, y, { font: ctx.italicFont, size: 10, color: ctx.colors.gray });
    y -= 10;
    ctx.drawLine(y);
    y -= 25;

    // Document info
    y = ctx.drawRow("Voucher Code", String(s.code ?? "N/A"), y);
    y = ctx.drawRow("Booking Reference", String(s.bookingCode ?? "N/A"), y);
    y = ctx.drawRow("Order Reference", String(s.orderCode ?? "N/A"), y);
    y = ctx.drawRow("Service", String(s.serviceName ?? "N/A"), y);
    if (s.serviceDate) {
      const dateStr = `${s.serviceDate}${s.serviceTime ? ` ${s.serviceTime}` : ""}${s.serviceTimeZone ? ` (${s.serviceTimeZone})` : ""}`;
      y = ctx.drawRow("Service Date", dateStr, y);
    }
    y -= 10;

    // Payment summary
    ctx.drawText("PAYMENT SUMMARY", ctx.margin, y, { font: ctx.boldFont, size: 11, color: ctx.colors.dark });
    y -= 5;
    ctx.drawLine(y);
    y -= 18;
    y = ctx.drawRow("Total Amount", `${s.totalAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Amount Paid", `${s.paidAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Balance", `0.00 ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Payment Status", String(s.paymentStatus ?? "N/A"), y);
    y -= 10;

    // Travelers
    const travelers = (s.travelers as Array<Record<string, unknown>> | undefined) ?? [];
    if (travelers.length > 0) {
      ctx.drawText("TRAVELERS", ctx.margin, y, { font: ctx.boldFont, size: 11, color: ctx.colors.dark });
      y -= 5;
      ctx.drawLine(y);
      y -= 18;

      // Table header
      ctx.drawText("Name", ctx.margin, y, { font: ctx.boldFont, size: 9, color: ctx.colors.gray });
      ctx.drawText("Citizenship", ctx.margin + 220, y, { font: ctx.boldFont, size: 9, color: ctx.colors.gray });
      ctx.drawText("Gender", ctx.margin + 330, y, { font: ctx.boldFont, size: 9, color: ctx.colors.gray });
      y -= 15;

      for (const t of travelers) {
        ctx.drawText(`${t.firstName ?? ""} ${t.lastName ?? ""}`, ctx.margin, y, { size: 9 });
        ctx.drawText(String(t.citizenship ?? "—"), ctx.margin + 220, y, { size: 9 });
        ctx.drawText(String(t.gender ?? "—"), ctx.margin + 330, y, { size: 9 });
        y -= 14;
      }
    }

    return y;
  }

  private renderPartialPayment(
    _pdfDoc: PDFDocument,
    _page: any,
    s: Record<string, unknown>,
    ctx: { margin: number; contentWidth: number; y: number; font: any; boldFont: any; italicFont: any; colors: any; drawLine: any; drawText: any; drawRow: any },
  ): number {
    let { y } = ctx;

    ctx.drawText("TRAVELHUB PARTIAL PAYMENT DOCUMENT", ctx.margin, y, { font: ctx.boldFont, size: 18, color: ctx.colors.primary });
    y -= 20;
    ctx.drawText("Payment State Confirmation", ctx.margin, y, { font: ctx.italicFont, size: 10, color: ctx.colors.gray });
    y -= 10;
    ctx.drawLine(y);
    y -= 25;

    y = ctx.drawRow("Document Code", String(s.code ?? "N/A"), y);
    y = ctx.drawRow("Booking Reference", String(s.bookingCode ?? "N/A"), y);
    y = ctx.drawRow("Order Reference", String(s.orderCode ?? "N/A"), y);
    y = ctx.drawRow("Service", String(s.serviceName ?? "N/A"), y);
    y -= 10;

    ctx.drawText("PAYMENT DETAILS", ctx.margin, y, { font: ctx.boldFont, size: 11, color: ctx.colors.dark });
    y -= 5;
    ctx.drawLine(y);
    y -= 18;

    const total = Number(s.totalAmount ?? 0);
    const paid = Number(s.paidAmount ?? 0);
    y = ctx.drawRow("Total Amount", `${s.totalAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Amount Paid", `${s.paidAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Remaining Balance", `${Math.max(0, total - paid).toFixed(2)} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Payment Status", String(s.paymentStatus ?? "N/A"), y);

    return y;
  }

  private renderRefund(
    _pdfDoc: PDFDocument,
    _page: any,
    s: Record<string, unknown>,
    ctx: { margin: number; contentWidth: number; y: number; font: any; boldFont: any; italicFont: any; colors: any; drawLine: any; drawText: any; drawRow: any },
  ): number {
    let { y } = ctx;

    ctx.drawText("TRAVELHUB REFUND DOCUMENT", ctx.margin, y, { font: ctx.boldFont, size: 18, color: ctx.colors.primary });
    y -= 20;
    ctx.drawText("Refund Processing Confirmation", ctx.margin, y, { font: ctx.italicFont, size: 10, color: ctx.colors.gray });
    y -= 10;
    ctx.drawLine(y);
    y -= 25;

    y = ctx.drawRow("Document Code", String(s.code ?? "N/A"), y);
    y = ctx.drawRow("Booking Reference", String(s.bookingCode ?? "N/A"), y);
    y = ctx.drawRow("Order Reference", String(s.orderCode ?? "N/A"), y);
    if (s.refundCode) {
      y = ctx.drawRow("Refund Reference", String(s.refundCode), y);
    }
    y -= 10;

    ctx.drawText("REFUND DETAILS", ctx.margin, y, { font: ctx.boldFont, size: 11, color: ctx.colors.dark });
    y -= 5;
    ctx.drawLine(y);
    y -= 18;

    y = ctx.drawRow("Original Paid Amount", `${s.originalPaidAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("This Refund Amount", `${s.refundAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Total Refunded", `${s.refundedAmount ?? "N/A"} ${s.currency ?? ""}`, y);
    y = ctx.drawRow("Payment Status", String(s.paymentStatus ?? "N/A"), y);
    if (s.refundDate) {
      y = ctx.drawRow("Refund Date", String(s.refundDate), y);
    }

    return y;
  }
}
