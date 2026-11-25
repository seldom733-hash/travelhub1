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
  sourceId?: string | null;
  code?: string | null;
  bookingId?: string | null;
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
  bookingId?: string | null;
  orderId: string;
  orderCode?: string | null;
  dealSequence?: string | null;
  serviceDate: Date | null;
  totalAmount: Prisma.Decimal | null;
  paidAmount: Prisma.Decimal | null;
  currency: string | null;
  paymentStatus: string | null;
  version: number;
  createdAt: Date;
}

/** Поля Document, нужные для enrich (findMany без select возвращает их все). */
interface DocumentEnrichRow {
  id: string;
  code: string;
  type: DocumentType;
  status: DocumentStatus;
  bookingId: string | null;
  orderId: string;
  serviceDate: Date | null;
  totalAmount: Prisma.Decimal | null;
  paidAmount: Prisma.Decimal | null;
  currency: string | null;
  paymentStatus: string | null;
  version: number;
  createdAt: Date;
}

/** Whitelist полей серверной сортировки реестра документов. */
const DOCUMENT_SORT_FIELDS = new Set([
  "code",
  "type",
  "status",
  "serviceDate",
  "totalAmount",
  "paidAmount",
  "version",
  "createdAt",
]);

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
    const code = input.code ?? await this.ids.nextCode(tx, this.prefixForType(input.type));
    const doc = await tx.document.create({
      data: {
        code,
        type: input.type,
        sourceId: input.sourceId ?? null,
        status: "NOT_ISSUED",
        bookingId: input.bookingId ?? null,
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
      items: await this.enrichDocumentItems(items),
      total,
    };
  }

  /**
   * Resolve display references (booking/order/deal) for a page of documents.
   * Single source of truth for BOTH the admin registry and the buyer cabinet,
   * so the contract cannot drift between them.
   */
  private async enrichDocumentItems(items: DocumentEnrichRow[]): Promise<DocumentListItem[]> {
    const orderIds = [...new Set(items.map((d) => d.orderId))];
    const bookingIds = [...new Set(items.map((d) => d.bookingId).filter((id): id is string => Boolean(id)))];
    const [orders, bookings] = await Promise.all([
      orderIds.length
        ? this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, code: true, commerceSequence: true },
          })
        : Promise.resolve([]),
      bookingIds.length
        ? this.prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, code: true } })
        : Promise.resolve([]),
    ]);
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    return items.map((d) => {
      const order = orderMap.get(d.orderId);
      const booking = d.bookingId ? bookingMap.get(d.bookingId) : null;
      return {
        id: d.id,
        code: d.code,
        type: d.type,
        status: d.status,
        bookingCode: booking?.code ?? null,
        bookingId: d.bookingId,
        orderId: d.orderId,
        orderCode: order?.code ?? null,
        // Только commerceSequence: ссылка /app/finance/deals/[sequence] резолвится
        // именно по нему; fallback на хвост referenceNumber давал битые ссылки.
        dealSequence: order?.commerceSequence ?? null,
        serviceDate: d.serviceDate,
        totalAmount: d.totalAmount,
        paidAmount: d.paidAmount,
        currency: d.currency,
        paymentStatus: d.paymentStatus,
        version: d.version,
        createdAt: d.createdAt,
      };
    });
  }

  /**
   * List documents for admin/operator (all documents, with PII projection).
   */
  async listAllDocuments(
    page = 1,
    pageSize = 20,
    type?: DocumentType,
    status?: DocumentStatus,
    q?: string,
    sortBy?: string,
    sortDirection?: "asc" | "desc",
  ): Promise<{
    items: DocumentListItem[];
    total: number;
    aggregates: { type: { VOUCHER: number; PARTIAL_PAYMENT: number; REFUND: number } };
  }> {
    const where: Prisma.DocumentWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;

    // Server-side search: document code + referenced order/booking codes.
    // Without it the registry search only filtered the current 20-row page.
    const query = q?.trim();
    if (query) {
      const [orders, bookings] = await Promise.all([
        this.prisma.order.findMany({
          where: {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { referenceNumber: { contains: query, mode: "insensitive" } },
              { commerceSequence: { contains: query } },
            ],
          },
          select: { id: true },
          take: 500,
        }),
        this.prisma.booking.findMany({
          where: { code: { contains: query, mode: "insensitive" } },
          select: { id: true },
          take: 500,
        }),
      ]);
      const or: Prisma.DocumentWhereInput[] = [{ code: { contains: query, mode: "insensitive" } }];
      if (orders.length > 0) or.push({ orderId: { in: orders.map((o) => o.id) } });
      if (bookings.length > 0) or.push({ bookingId: { in: bookings.map((b) => b.id) } });
      where.OR = or;
    }

    const sortField = sortBy && DOCUMENT_SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
    const sortDir = sortDirection === "asc" ? "asc" : "desc";
    const orderBy = { [sortField]: sortDir } as Prisma.DocumentOrderByWithRelationInput;

    const [items, total, typeAgg] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
      this.prisma.document.groupBy({
        by: ["type"],
        _count: { type: true },
        where,
      }),
    ]);

    // Build aggregates — all three types must be present even if 0
    const typeCounts: Record<string, number> = { VOUCHER: 0, PARTIAL_PAYMENT: 0, REFUND: 0 };
    for (const row of typeAgg) {
      typeCounts[row.type] = row._count.type;
    }

    return {
      items: await this.enrichDocumentItems(items),
      total,
      aggregates: { type: typeCounts as { VOUCHER: number; PARTIAL_PAYMENT: number; REFUND: number } },
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
