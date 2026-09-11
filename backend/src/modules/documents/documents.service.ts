import { Inject, Injectable, Logger } from "@nestjs/common";
import type { DocumentStatus, DocumentType, Prisma } from "../../generated/prisma/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents } from "../../eventbus/domain-events";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type { ObjectStorageService } from "../catalog/media/storage/storage.interface";
import { DocumentRenderer } from "./document-renderer.service";

const CONSUMER_ID = "documents-voucher-consumer";
const REFUND_CONSUMER_ID = "documents-refund-consumer";
const INVALIDATION_CONSUMER_ID = "documents-invalidation-consumer";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

export interface CreateDocumentInput {
  type: DocumentType;
  bookingId: string;
  orderId: string;
  customerId?: string | null;
  serviceDate?: Date | null;
  serviceTime?: string | null;
  serviceTimeZone?: string | null;
  totalAmount?: Prisma.Decimal | null;
  paidAmount?: Prisma.Decimal | null;
  currency?: string | null;
  paymentStatus?: string | null;
}

export interface DocumentListItem {
  id: string;
  code: string;
  type: DocumentType;
  status: DocumentStatus;
  bookingCode: string | null;
  serviceDate: Date | null;
  totalAmount: Prisma.Decimal | null;
  paidAmount: Prisma.Decimal | null;
  currency: string | null;
  paymentStatus: string | null;
  version: number;
  createdAt: Date;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
    private readonly renderer: DocumentRenderer,
    @Inject("ObjectStorageService") private readonly storage: ObjectStorageService,
  ) {}

  /**
   * Create a Document entity in NOT_ISSUED state.
   * Called by consumers when dual-gate or refund conditions are met.
   */
  async createDocument(
    tx: Prisma.TransactionClient,
    input: CreateDocumentInput,
  ): Promise<{ id: string; code: string }> {
    const code = await this.ids.nextCode(tx, this.prefixForType(input.type));
    const doc = await tx.document.create({
      data: {
        code,
        type: input.type,
        status: "NOT_ISSUED",
        bookingId: input.bookingId,
        orderId: input.orderId,
        customerId: input.customerId ?? null,
        serviceDate: input.serviceDate ?? null,
        serviceTime: input.serviceTime ?? null,
        serviceTimeZone: input.serviceTimeZone ?? null,
        totalAmount: input.totalAmount ?? null,
        paidAmount: input.paidAmount ?? null,
        currency: input.currency ?? null,
        paymentStatus: input.paymentStatus ?? null,
      },
      select: { id: true, code: true },
    });
    return doc;
  }

  /**
   * Issue a document: render PDF, store in S3, create DocumentVersion,
   * transition Document status to ISSUED.
   *
   * INVARIANT: storage MUST succeed before any ISSUED state is written.
   * On storage failure, throws (transaction rolls back, consumer retries).
   * Document stays NOT_ISSUED — no false downloadable state is exposed.
   */
  async issueDocument(
    tx: Prisma.TransactionClient,
    documentId: string,
    triggeringEvent: string,
    snapshot: Record<string, unknown>,
  ): Promise<{ versionNumber: number; s3Key: string }> {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });

    // Determine next version number
    const lastVersion = await tx.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

    // Render PDF
    const pdfBuffer = await this.renderer.render(doc.type, snapshot);

    // Storage MUST succeed before creating version or ISSUED state.
    // On failure, throw — transaction rolls back, consumer retries later.
    const s3Key = `documents/${documentId}/v${nextVersion}.pdf`;
    const stored = await this.storage.putObject({
      key: s3Key,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    // Create version record — only reachable after storage succeeds
    const version = await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber: nextVersion,
        status: "ISSUED",
        s3Key,
        fileSize: stored.size,
        issuedAt: new Date(),
        triggeringEvent,
        snapshot: snapshot as unknown as JsonValue,
      },
      select: { versionNumber: true, s3Key: true, id: true },
    });

    // Update document: status → ISSUED, currentVersionId → version.id
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: "ISSUED",
        currentVersionId: version.id,
      },
    });

    // Create history entry
    await tx.documentHistory.create({
      data: {
        documentId,
        action: "issued",
        from: "NOT_ISSUED",
        to: "ISSUED",
        versionNumber: nextVersion,
        comment: `Triggered by ${triggeringEvent}`,
      },
    });

    this.logger.log(`Document ${doc.code} issued v${nextVersion} (${triggeringEvent})`);

    return { versionNumber: version.versionNumber, s3Key: version.s3Key as string };
  }

  /**
   * Invalidate a document: transition status to INVALIDATED.
   * Binary is retained; download is blocked.
   */
  async invalidateDocument(
    tx: Prisma.TransactionClient,
    documentId: string,
    reason: string,
  ): Promise<void> {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
    if (doc.status === "INVALIDATED") return; // already invalidated (idempotent)
    if (doc.status === "SUPERSEDED") return; // superseded documents stay superseded

    const previousStatus = doc.status;
    await tx.document.update({
      where: { id: documentId },
      data: { status: "INVALIDATED" },
    });

    await tx.documentHistory.create({
      data: {
        documentId,
        action: "invalidated",
        from: previousStatus,
        to: "INVALIDATED",
        comment: reason,
      },
    });

    this.logger.log(`Document ${doc.code} invalidated: ${reason}`);
  }

  /**
   * Supersede a document: transition old version to SUPERSEDED.
   * Used when a new version replaces the current one.
   */
  async supersedeDocument(
    tx: Prisma.TransactionClient,
    documentId: string,
    reason: string,
  ): Promise<void> {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
    if (doc.status !== "ISSUED") return;

    await tx.document.update({
      where: { id: documentId },
      data: { status: "SUPERSEDED" },
    });

    await tx.documentHistory.create({
      data: {
        documentId,
        action: "superseded",
        from: "ISSUED",
        to: "SUPERSEDED",
        comment: reason,
      },
    });
  }

  /**
   * Get a signed download URL for a document version.
   */
  async getDownloadUrl(documentId: string, userId: string, userRole: string): Promise<{ url: string; code: string }> {
    const doc = await this.prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      include: { versions: { where: { status: "ISSUED" }, orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    // Status check
    if (doc.status === "INVALIDATED") {
      throw new ConflictError("Document has been invalidated and is not downloadable");
    }
    if (doc.status === "NOT_ISSUED") {
      throw new ConflictError("Document has not been issued yet");
    }

    // Ownership check for BUYER
    if (userRole === "BUYER") {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.customerId || user.customerId !== doc.customerId) {
        throw new ConflictError("Access denied: document does not belong to this buyer");
      }
    }

    const version = doc.versions[0];
    if (!version?.s3Key) {
      throw new ConflictError("Document version has no stored binary");
    }

    const s3Key = version.s3Key as string;
    try {
      const url = await this.storage.getSignedReadUrl(s3Key, SIGNED_URL_TTL_SECONDS);
      return { url, code: doc.code };
    } catch (err) {
      this.logger.error(`Storage unavailable for download of ${doc.code} (${s3Key}): ${(err as Error)?.message}`);
      throw new ConflictError("Document storage is temporarily unavailable");
    }
  }

  /**
   * List documents for a buyer (own-scope).
   */
  async listBuyerDocuments(userId: string, page = 1, pageSize = 20): Promise<{ items: DocumentListItem[]; total: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.customerId) return { items: [], total: 0 };

    const where = { customerId: user.customerId };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { versions: { where: { status: "ISSUED" }, take: 1 } },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      items: items.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        status: d.status,
        bookingCode: null, // resolved separately if needed
        serviceDate: d.serviceDate,
        totalAmount: d.totalAmount,
        paidAmount: d.paidAmount,
        currency: d.currency,
        paymentStatus: d.paymentStatus,
        version: d.version,
        createdAt: d.createdAt,
      })),
      total,
    };
  }

  /**
   * List documents for admin/operator (all documents, with PII projection).
   */
  async listAllDocuments(
    page = 1,
    pageSize = 20,
    type?: DocumentType,
    status?: DocumentStatus,
  ): Promise<{ items: DocumentListItem[]; total: number }> {
    const where: Prisma.DocumentWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      items: items.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        status: d.status,
        bookingCode: null,
        serviceDate: d.serviceDate,
        totalAmount: d.totalAmount,
        paidAmount: d.paidAmount,
        currency: d.currency,
        paymentStatus: d.paymentStatus,
        version: d.version,
        createdAt: d.createdAt,
      })),
      total,
    };
  }

  /**
   * Get document detail with versions and snapshot.
   */
  async getDocument(documentId: string) {
    return this.prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  private prefixForType(type: DocumentType): string {
    switch (type) {
      case "PARTIAL_PAYMENT": return "PPD";
      case "VOUCHER": return "VCH";
      case "REFUND": return "RFD";
    }
  }
}
