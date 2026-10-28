/**
 * Evidence documents for supplier payments (Finance completion, 2026-10-25).
 *
 * Binary files live in the PRIVATE S3 bucket; DB stores metadata only. Client
 * never receives a storage key or a public URL — only a short-lived signed URL
 * through an authenticated, permissioned endpoint.
 *
 * Rules:
 *  - allowed types: PDF/JPEG/PNG/WebP; max 10 MB, max 10 active docs/payment;
 *  - upload allowed while payment is PENDING/CONFIRMED (bank slip may arrive
 *    after execution); CANCELLED payment is closed for new evidence;
 *  - delete is soft (audit trail) and allowed only while payment is PENDING —
 *    an executed payment's evidence is immutable from the UI;
 *  - storage write happens before DB row; DB failure removes the object
 *    (compensating cleanup), mirroring ProductMediaService.
 */
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import type { ObjectStorageService } from "../catalog/media/storage/storage.interface";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DOCS_PER_PAYMENT = 10;
const SIGNED_TTL_SECONDS = 300;

const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Content sniffing: MIME из multipart можно подделать; сверяем сигнатуру. */
function sniffMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

export interface EvidenceFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class SupplierPaymentEvidenceService {
  private readonly logger = new Logger(SupplierPaymentEvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    @Inject("ObjectStorageService") private readonly storage: ObjectStorageService,
  ) {}

  private async loadPayment(codeOrId: string) {
    const payment = await this.prisma.supplierPayout.findFirst({
      where: { OR: [{ code: codeOrId }, { id: codeOrId }] },
      select: { id: true, code: true, status: true },
    });
    if (!payment) throw new NotFoundError(`SupplierPayment ${codeOrId} not found`);
    return payment;
  }

  private sanitizeFileName(raw: string): string {
    const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
    const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_").replace(/\s+/g, " ").trim();
    return (cleaned || "document").slice(0, 200);
  }

  async list(codeOrId: string) {
    const payment = await this.loadPayment(codeOrId);
    const rows = await this.prisma.supplierPaymentEvidence.findMany({
      where: { payoutId: payment.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, mimeType: true, size: true, uploadedById: true, createdAt: true },
    });
    return {
      paymentCode: payment.code,
      items: rows.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        mimeType: r.mimeType,
        size: r.size,
        uploadedById: r.uploadedById,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async upload(codeOrId: string, files: EvidenceFile[], actor: Actor) {
    const payment = await this.loadPayment(codeOrId);
    if (payment.status === "CANCELLED") {
      throw new ConflictError(`supplier payment ${payment.code} is CANCELLED; evidence is closed`);
    }
    if (!files || files.length === 0) throw new ValidationDomainError("No files provided for upload");
    const existing = await this.prisma.supplierPaymentEvidence.count({
      where: { payoutId: payment.id, deletedAt: null },
    });
    if (existing + files.length > MAX_DOCS_PER_PAYMENT) {
      throw new ValidationDomainError(`Too many documents: max ${MAX_DOCS_PER_PAYMENT} per payment`);
    }

    const prepared = files.map((file) => {
      const mimeType = (file.mimetype ?? "").toLowerCase().trim();
      if (!ALLOWED_MIME[mimeType]) {
        throw new ValidationDomainError(
          `Unsupported document type "${file.mimetype}". Allowed: PDF, JPEG, PNG, WebP`,
        );
      }
      if (!file.size || file.size > MAX_FILE_BYTES) {
        throw new ValidationDomainError("Document is empty or exceeds the 10 MB limit");
      }
      if (!file.buffer || file.buffer.length === 0) {
        throw new ValidationDomainError("Empty document buffer");
      }
      const sniffed = sniffMime(file.buffer);
      if (sniffed !== mimeType) {
        throw new ValidationDomainError(
          `Document content does not match its declared type (${file.mimetype})`,
        );
      }
      return {
        fileName: this.sanitizeFileName(file.originalname),
        mimeType,
        size: file.size,
        buffer: file.buffer,
      };
    });

    const uploadedKeys: string[] = [];
    try {
      // 1) Storage first (тяжёлая операция вне транзакции БД).
      for (const file of prepared) {
        const key = `finance/supplier-payments/${payment.id}/${randomUUID()}-${file.fileName}`;
        await this.storage.putObject({ key, body: file.buffer, contentType: file.mimeType });
        uploadedKeys.push(key);
      }
      // 2) Metadata + audit — одной транзакцией: либо все документы, либо ни одного.
      const created = await this.prisma.$transaction(async (tx) => {
        const rows: Array<{ id: string; fileName: string; mimeType: string; size: number; createdAt: Date }> = [];
        for (let i = 0; i < prepared.length; i += 1) {
          const row = await tx.supplierPaymentEvidence.create({
            data: {
              payoutId: payment.id,
              storageKey: uploadedKeys[i],
              fileName: prepared[i].fileName,
              mimeType: prepared[i].mimeType,
              size: prepared[i].size,
              uploadedById: actor.id,
            },
            select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
          });
          rows.push(row);
          await this.security.audit(tx, {
            action: "finance.supplier_payment.document_uploaded",
            resource: "SupplierPayout",
            resourceId: payment.id,
            details: {
              paymentCode: payment.code,
              documentId: row.id,
              fileName: row.fileName,
              mimeType: row.mimeType,
              size: row.size,
              actor: actor.username,
            },
          });
        }
        return rows;
      });

      return {
        paymentCode: payment.code,
        items: created.map((r) => ({
          id: r.id,
          fileName: r.fileName,
          mimeType: r.mimeType,
          size: r.size,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    } catch (err) {
      // Компенсация: объекты, уже записанные в S3, удаляем; DB-строки не остаются.
      for (const key of uploadedKeys) {
        try {
          await this.storage.deleteObject(key);
        } catch (cleanupErr) {
          this.logger.error(`evidence cleanup failed for ${key}: ${(cleanupErr as Error).message}`);
        }
      }
      throw err instanceof ValidationDomainError ? err : new ValidationDomainError(`Storage unavailable: ${(err as Error).message}`);
    }
  }

  /** Signed URL на скачивание; доступ проверяется по платежу и permissions в controller. */
  async download(codeOrId: string, documentId: string): Promise<{ url: string; fileName: string; mimeType: string }> {
    const payment = await this.loadPayment(codeOrId);
    const doc = await this.prisma.supplierPaymentEvidence.findFirst({
      where: { id: documentId, payoutId: payment.id, deletedAt: null },
      select: { storageKey: true, fileName: true, mimeType: true },
    });
    if (!doc) throw new NotFoundError("Document not found");
    const url = await this.storage.getSignedReadUrl(doc.storageKey, SIGNED_TTL_SECONDS);
    return { url, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async remove(codeOrId: string, documentId: string, actor: Actor): Promise<{ ok: true }> {
    const payment = await this.loadPayment(codeOrId);
    if (payment.status !== "PENDING") {
      throw new ConflictError(
        `cannot delete evidence of ${payment.code}: payment is ${payment.status}; executed payments keep their documents`,
      );
    }
    const doc = await this.prisma.supplierPaymentEvidence.findFirst({
      where: { id: documentId, payoutId: payment.id, deletedAt: null },
      select: { id: true, storageKey: true, fileName: true },
    });
    if (!doc) throw new NotFoundError("Document not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.supplierPaymentEvidence.update({
        where: { id: doc.id },
        data: { deletedAt: new Date(), deletedById: actor.id },
      });
      await this.security.audit(tx, {
        action: "finance.supplier_payment.document_deleted",
        resource: "SupplierPayout",
        resourceId: payment.id,
        details: { paymentCode: payment.code, documentId: doc.id, fileName: doc.fileName, actor: actor.username },
      });
    });
    try {
      await this.storage.deleteObject(doc.storageKey);
    } catch (err) {
      // Metadata уже soft-deleted; файл недоступен через API. Ошибку хранилища
      // логируем (orphan object), но операцию не откатываем.
      this.logger.error(`evidence object delete failed for ${doc.storageKey}: ${(err as Error).message}`);
    }
    return { ok: true };
  }
}
