import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma, type MediaStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import { RoleCode } from "../../../generated/prisma/enums";
import type { ObjectStorageService } from "./storage/storage.interface";
import { MediaProcessor } from "./media-processor.service";
import { CatalogAccessPolicy } from "../catalog-access.policy";

export interface MediaFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const SIGNED_URL_TTL_SECONDS = 300; // short-lived preview (5 min)

/**
 * ProductMediaService (Phase 1 Step 1.2) — media Product принадлежит Catalog.
 *
 * Фиксированные решения Step 1.2:
 *  - binary-файлы → S3-compatible Object Storage; metadata → PostgreSQL (Prisma);
 *  - derivatives: original + large.webp + thumb.webp (sharp);
 *  - private-by-default: uploaded != published; draft media не появляется в public read;
 *  - атомарность: Sharp/processing ВНЕ Prisma-транзакции; storage write → DB write
 *    с compensating cleanup (DB failure удаляет уже загруженные objects);
 *  - storage failure НЕ создаёт DB record.
 *
 * RBAC object scope (Step 1.3): единая политика CatalogAccessPolicy —
 * PARTNER — только собственные Product; MODERATOR — только moderation read/preview
 * (read_for_moderation), без write за PARTNER; ADMIN — через explicit permissions.
 * ProductMedia НЕ имеет независимого владельца: ownership наследуется через
 * Product.partnerId (ProductMedia.productId → Product.partnerId).
 */
@Injectable()
export class ProductMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("ObjectStorageService") private readonly storage: ObjectStorageService,
    private readonly processor: MediaProcessor,
    private readonly policy: CatalogAccessPolicy,
  ) {}

  // ── Upload (multi) ──────────────────────────────────────────────────────────

  async uploadMedia(productId: string, files: MediaFile[], actor: AuthUser) {
    const product = await this.requireOwnedProduct(productId, actor, "catalog.media.upload_own");
    if (!files || files.length === 0) {
      throw new ValidationDomainError("No files provided for upload");
    }

    const maxImages = await this.resolveMaxImages(product);
    const existing = await this.prisma.productMedia.count({ where: { productId } });
    if (existing + files.length > maxImages) {
      throw new ValidationDomainError(`Too many images: max ${maxImages} for this product (has ${existing}, +${files.length})`);
    }

    // 1) Validate + process (Sharp) ВНЕ транзакции — тяжёлая работа не блокирует БД.
    const processedList = await Promise.all(
      files.map(async (f) => ({
        file: f,
        processed: await this.processor.processImage(f.buffer, await this.allowedMimeTypes(product)),
      })),
    );

    // 2) Storage write (все объекты) — до DB, чтобы при падении БД был cleanup.
    const keys: Array<{ mediaId: string; file: MediaFile; processed: Awaited<ReturnType<MediaProcessor["processImage"]>>; original: string; large: string; thumb: string }> = [];
    const uploadedKeys: string[] = [];
    try {
      for (const { file, processed } of processedList) {
        const mediaId = randomUUID();
        const ext = processed.format === "jpeg" ? "jpg" : processed.format;
        const k = {
          original: `products/${productId}/${mediaId}/original.${ext}`,
          large: `products/${productId}/${mediaId}/large.webp`,
          thumb: `products/${productId}/${mediaId}/thumb.webp`,
        };
        // Ключи регистрируются ДО записей: если частичная запись падает (например,
        // original записан, large не удался), все ключи этой записи уже в списке
        // cleanup — ни один объект не осиротеет.
        uploadedKeys.push(k.original, k.large, k.thumb);
        await this.storage.putObject({ key: k.original, body: processed.original, contentType: processed.mimeType });
        await this.storage.putObject({ key: k.large, body: processed.large, contentType: "image/webp" });
        await this.storage.putObject({ key: k.thumb, body: processed.thumb, contentType: "image/webp" });
        keys.push({ mediaId, file, processed, ...k });
      }
    } catch (err) {
      // Storage failure → НЕ создаём DB records; чистим уже загруженные объекты.
      await this.cleanupObjects(uploadedKeys);
      throw err instanceof ValidationDomainError
        ? err
        : new ValidationDomainError(`Storage unavailable: ${(err as Error).message}`);
    }

    // 3) DB write (metadata) — transaction; failure → compensating cleanup.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const agg = await tx.productMedia.aggregate({ where: { productId }, _max: { sortOrder: true } });
        let order = (agg._max.sortOrder ?? -1) + 1;
        const hasPrimary = await tx.productMedia.findFirst({ where: { productId, isPrimary: true }, select: { id: true } });

        const created: unknown[] = [];
        for (const item of keys) {
          const row = await tx.productMedia.create({
            data: {
              id: item.mediaId,
              productId,
              type: "IMAGE",
              originalStorageKey: item.original,
              largeStorageKey: item.large,
              thumbnailStorageKey: item.thumb,
              originalFileName: item.file.originalname || "image",
              mimeType: item.processed.mimeType,
              size: item.processed.size,
              width: item.processed.width,
              height: item.processed.height,
              sortOrder: order++,
              // Ровно одна primary: только первая загружаемая запись, когда у продукта
              // ещё нет primary (existing == 0 — до загрузки). Для последующих — false.
              isPrimary: !hasPrimary && existing === 0 && created.length === 0,
              status: "DRAFT",
              createdById: actor.id,
            },
          });
          created.push(this.toMediaView(row));
        }
        return { media: created, product: { id: product.id, code: product.code } };
      });
    } catch (err) {
      await this.cleanupObjects(uploadedKeys);
      // DB-level invariant (partial unique index): два concurrent first-upload'а на
      // пустой продукт — один проигрывает (P2002) → управляемый 409 вместо 500.
      if (this.isPrimaryUniqueViolation(err)) {
        throw new ConflictError("Primary media conflict: another upload set the primary image concurrently");
      }
      throw err;
    } finally {
      await this.audit(product.id, "media.uploaded", { count: files.length }, actor);
    }
  }

  // ── Replace (новая версия файла → DRAFT, не публикуется до publish transition) ──

  async replaceMedia(productId: string, mediaId: string, file: MediaFile, actor: AuthUser) {
    const product = await this.requireOwnedProduct(productId, actor, "catalog.media.update_own");
    const existing = await this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) throw new NotFoundError(`Media ${mediaId} not found for product ${productId}`);

    const processed = await this.processor.processImage(file.buffer, await this.allowedMimeTypes(product));
    const newId = randomUUID();
    const ext = processed.format === "jpeg" ? "jpg" : processed.format;
    const k = {
      original: `products/${productId}/${newId}/original.${ext}`,
      large: `products/${productId}/${newId}/large.webp`,
      thumb: `products/${productId}/${newId}/thumb.webp`,
    };
    const uploadedKeys = [k.original, k.large, k.thumb];
    try {
      await this.storage.putObject({ key: k.original, body: processed.original, contentType: processed.mimeType });
      await this.storage.putObject({ key: k.large, body: processed.large, contentType: "image/webp" });
      await this.storage.putObject({ key: k.thumb, body: processed.thumb, contentType: "image/webp" });
    } catch (err) {
      await this.cleanupObjects(uploadedKeys);
      throw new ValidationDomainError(`Storage unavailable: ${(err as Error).message}`);
    }

    try {
      const updated = await this.prisma.productMedia.update({
        where: { id: mediaId },
        data: {
          originalStorageKey: k.original,
          largeStorageKey: k.large,
          thumbnailStorageKey: k.thumb,
          originalFileName: file.originalname || existing.originalFileName,
          mimeType: processed.mimeType,
          size: processed.size,
          width: processed.width,
          height: processed.height,
          // Замена = неопубликованная версия: не появляется в public read до publish transition.
          status: "DRAFT",
          updatedAt: new Date(),
        },
      });
      await this.cleanupObjects([existing.originalStorageKey, existing.largeStorageKey, existing.thumbnailStorageKey]);
      await this.audit(product.id, "media.replaced", { mediaId }, actor);
      return this.toMediaView(updated);
    } catch (err) {
      await this.cleanupObjects(uploadedKeys);
      throw err;
    }
  }

  // ── Update (caption/altText) ────────────────────────────────────────────────

  async updateMedia(productId: string, mediaId: string, input: { caption?: string; altText?: string }, actor: AuthUser) {
    const product = await this.requireOwnedProduct(productId, actor, "catalog.media.update_own");
    const existing = await this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) throw new NotFoundError(`Media ${mediaId} not found for product ${productId}`);
    // Step 1.3 review fix: PARTNER не может прямо менять caption/altText PUBLISHED media
    // (живой контент) — только через DRAFT-версию (replace/upload + controlled publish).
    this.assertNoLiveMediaMutation(actor, product, existing);

    const updated = await this.prisma.productMedia.update({
      where: { id: mediaId },
      data: {
        caption: input.caption !== undefined ? input.caption : existing.caption,
        altText: input.altText !== undefined ? input.altText : existing.altText,
      },
    });
    await this.audit(product.id, "media.metadata_changed", { mediaId, fields: Object.keys(input) }, actor);
    return this.toMediaView(updated);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteMedia(productId: string, mediaId: string, actor: AuthUser) {
    const product = await this.requireOwnedProduct(productId, actor, "catalog.media.delete_own");
    const existing = await this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) throw new NotFoundError(`Media ${mediaId} not found for product ${productId}`);
    // Step 1.3 review fix: PARTNER не может удалять PUBLISHED media напрямую (живой
    // контент) — удаление live media обходит re-moderation workflow.
    this.assertNoLiveMediaMutation(actor, product, existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.productMedia.delete({ where: { id: mediaId } });
      // Primary rule (ТЗ §11): если удаляется primary и остаются изображения —
      // назначаем primary media с минимальным sortOrder.
      if (existing.isPrimary) {
        const next = await tx.productMedia.findFirst({ where: { productId }, orderBy: { sortOrder: "asc" } });
        if (next) {
          await tx.productMedia.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }
    });

    // Compensating/идемпотентный cleanup объектов (best-effort).
    await this.cleanupObjects([existing.originalStorageKey, existing.largeStorageKey, existing.thumbnailStorageKey]);
    await this.audit(product.id, "media.deleted", { mediaId }, actor);
    return { deleted: true, mediaId };
  }

  // ── Primary ─────────────────────────────────────────────────────────────────

  async setPrimary(productId: string, mediaId: string, actor: AuthUser) {
    const product = await this.requireOwnedProduct(productId, actor, "catalog.media.set_primary_own");
    const media = await this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!media) throw new NotFoundError(`Media ${mediaId} not found for product ${productId}`);
    // Step 1.3 review fix: PARTNER не может менять primary у PUBLISHED media (живой
    // контент) — live-изменение обходит re-moderation workflow.
    this.assertNoLiveMediaMutation(actor, product, media);

    // Атомарно: снять предыдущий primary, установить новый. DB-level partial unique
    // index гарантирует инвариант даже при concurrent set-primary; проигравший
    // конкурент получает управляемый 409 (P2002), а не 500.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productMedia.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
        await tx.productMedia.update({ where: { id: mediaId }, data: { isPrimary: true } });
      });
    } catch (err) {
      if (this.isPrimaryUniqueViolation(err)) {
        throw new ConflictError("Primary media conflict: another concurrent set-primary won");
      }
      throw err;
    }
    await this.audit(product.id, "media.primary_changed", { mediaId }, actor);
    return this.toMediaView(await this.prisma.productMedia.findUniqueOrThrow({ where: { id: mediaId } }));
  }

  // ── Reorder ─────────────────────────────────────────────────────────────────

  async reorder(productId: string, orderedIds: string[], actor: AuthUser) {
    const product = await this.requireOwnedProduct(productId, actor, "catalog.media.reorder_own");
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new ValidationDomainError("orderedIds must be a non-empty array");
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new ValidationDomainError("orderedIds contains duplicate mediaIds");
    }

    const rows = await this.prisma.productMedia.findMany({ where: { productId }, select: { id: true, status: true } });
    // Step 1.3 review fix: PARTNER не может reorder, если в продукте есть PUBLISHED
    // media (живой порядок) — live-изменение обходит re-moderation workflow.
    this.assertNoLiveMediaMutation(actor, product, undefined, rows.some((r) => r.status === "PUBLISHED"));
    const existingIds = new Set(rows.map((r) => r.id));
    for (const id of orderedIds) {
      if (!existingIds.has(id)) throw new ValidationDomainError(`Media ${id} does not belong to product ${productId}`);
    }
    if (orderedIds.length !== rows.length) {
      throw new ValidationDomainError("orderedIds must include all media of the product");
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.productMedia.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } });
      }
    });
    await this.audit(product.id, "media.reordered", { order: orderedIds }, actor);
    return this.listMedia(productId, actor);
  }

  // ── Read / preview ──────────────────────────────────────────────────────────

  async listMedia(productId: string, actor?: AuthUser) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    // Step 1.3: read — владелец-PARTNER, MODERATOR (read_for_moderation) или staff read.
    if (actor && !this.policy.canRead(actor, product.partnerId)) {
      throw new ForbiddenException("Access to media of this product is not allowed");
    }
    const rows = await this.prisma.productMedia.findMany({
      where: { productId, status: { not: "ARCHIVED" } },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => this.toMediaView(r));
  }

  /**
   * Short-lived signed preview URL (private bucket).
   * Step 1.3: владелец-PARTNER, MODERATOR (read_for_moderation) или staff read;
   * MODERATOR preview разрешён (read_for_moderation), без write.
   */
  async signedPreviewUrl(productId: string, mediaId: string, actor: AuthUser, derivative: "original" | "large" | "thumb" = "large") {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanRead(actor, product.partnerId);
    const media = await this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!media) throw new NotFoundError(`Media ${mediaId} not found for product ${productId}`);
    const key = derivative === "original" ? media.originalStorageKey : derivative === "thumb" ? media.thumbnailStorageKey : media.largeStorageKey;
    const url = await this.storage.getSignedReadUrl(key, SIGNED_URL_TTL_SECONDS);
    return { url, expiresIn: SIGNED_URL_TTL_SECONDS, mediaId };
  }

  /** Достать файл media по mediaId для public read (только PUBLISHED, через signed URL). */
  async getPublishedFile(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const media = await this.prisma.productMedia.findUnique({ where: { id: mediaId } });
    if (!media || media.status !== "PUBLISHED") {
      throw new NotFoundError(`Media ${mediaId} is not published`);
    }
    const url = await this.storage.getSignedReadUrl(media.largeStorageKey, SIGNED_URL_TTL_SECONDS);
    return { url, mimeType: media.mimeType };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  /**
   * Step 1.3 review fix: PARTNER не может прямо мутировать PUBLISHED media
   * (metadata/delete/set-primary/reorder) — это живой контент; прямое изменение
   * обошло бы future re-moderation workflow. Мутации DRAFT media разрешены
   * (staging: upload/replace → DRAFT, публикуются только через controlled publish).
   * ADMIN — full lifecycle (explicit permissions); guard только для PARTNER.
   */
  private assertNoLiveMediaMutation(
    actor: AuthUser,
    product: { status: string },
    media?: { status?: string },
    anyPublished = false,
  ): void {
    if (actor.role !== RoleCode.PARTNER) return;
    if (product.status !== "DRAFT" && (anyPublished || media?.status === "PUBLISHED")) {
      throw new ConflictError(
        "Live (PUBLISHED) media cannot be edited directly by PARTNER; re-moderation required (stage a DRAFT version)",
      );
    }
  }

  /** RBAC object scope (Step 1.3): PARTNER — только свои; ADMIN — explicit permission; MODERATOR — 403. */
  private async requireOwnedProduct(productId: string, actor: AuthUser, permission?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, permission);
    // Step 1.4 §6/§13: PARTNER не может менять media проверяемой версии в обход
    // moderation workflow — при активной submission (SUBMITTED/IN_REVIEW) media
    // write заморожен. После CHANGES_REQUESTED (submission не активна) PARTNER
    // снова правит media, и изменения попадают в НОВУЮ submission. ADMIN — через
    // explicit permissions (полный lifecycle).
    if (actor.role === RoleCode.PARTNER) {
      const active = await this.prisma.moderationSubmission.count({
        where: { productId, isActiveSubmission: true },
      });
      if (active > 0) {
        throw new ConflictError(
          "Media is frozen while a moderation submission is active; wait for the decision or submit a new version after CHANGES_REQUESTED",
        );
      }
    }
    return product;
  }

  private async resolveMaxImages(product: { categoryId: string | null; categorySchemaId: string | null }): Promise<number> {
    const req = await this.mediaRequirementsOf(product);
    return req?.maxImages ?? 10;
  }

  private async allowedMimeTypes(product: { categoryId: string | null; categorySchemaId: string | null }): Promise<string[] | null> {
    const req = await this.mediaRequirementsOf(product);
    return req?.allowedMediaTypes ?? null;
  }

  /** mediaRequirements из Category Schema, на которую ссылается продукт (снапшот) либо ACTIVE. */
  private async mediaRequirementsOf(product: { categoryId: string | null; categorySchemaId: string | null }) {
    if (product.categorySchemaId) {
      const schema = await this.prisma.categorySchema.findUnique({ where: { id: product.categorySchemaId }, select: { mediaRequirements: true } });
      if (schema?.mediaRequirements) {
        return schema.mediaRequirements as {
          maxImages?: number;
          minImages?: number;
          primaryImageRequired?: boolean;
          allowedMediaTypes?: string[];
          videoAllowed?: boolean;
        };
      }
    }
    if (product.categoryId) {
      const schema = await this.prisma.categorySchema.findFirst({
        where: { categoryId: product.categoryId, status: "ACTIVE" },
        orderBy: { version: "desc" },
        select: { mediaRequirements: true },
      });
      if (schema?.mediaRequirements) {
        return schema.mediaRequirements as {
          maxImages?: number;
          minImages?: number;
          primaryImageRequired?: boolean;
          allowedMediaTypes?: string[];
          videoAllowed?: boolean;
        };
      }
    }
    return null;
  }

  /** Unique-violation от partial unique index (Postgres 23505 → Prisma P2002). */
  private isPrimaryUniqueViolation(err: unknown): boolean {
    return (
      (err as { code?: string })?.code === "P2002" ||
      (err as { meta?: { code?: string } })?.meta?.code === "23505"
    );
  }

  private async cleanupObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key);
      } catch {
        // best-effort
      }
    }
  }

  private async audit(productId: string, action: string, details: Record<string, unknown>, actor: AuthUser): Promise<void> {
    await this.prisma.productHistory.create({
      data: {
        productId,
        version: 0,
        action,
        fields: details as Prisma.InputJsonValue,
        actorId: actor.id,
        actorName: actor.username,
        comment: `Media: ${action}`,
      },
    });
  }

  /** Публичное представление media: БЕЗ storageKey, с short-lived signed preview URL. */
  private toMediaView(row: {
    id: string;
    type: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    sortOrder: number;
    isPrimary: boolean;
    caption: string | null;
    altText: string | null;
    status: MediaStatus;
    originalFileName: string;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      type: row.type,
      mimeType: row.mimeType,
      size: row.size,
      width: row.width,
      height: row.height,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      caption: row.caption,
      altText: row.altText,
      status: row.status,
      originalFileName: row.originalFileName,
      createdAt: row.createdAt,
      // previewUrl заполняется отдельным эндпоинтом (signed URL) — здесь не раскрываем ключи.
    };
  }
}
