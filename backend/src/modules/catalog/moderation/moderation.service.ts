import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma, type ModerationSubmissionStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import { CatalogAccessPolicy } from "../catalog-access.policy";
import { CatalogService, type ModerationSnapshot } from "../catalog.service";
import { AntiDisintermediationService } from "../anti-disintermediation/anti-disintermediation.service";

/** Stable backend reason codes (Step 1.4 §15). OTHER требует comment.
 * Step 1.11: anti-disintermediation reason codes (§13) — используются MODERATOR-ом
 * при reject/request_changes (детектор блокирует нарушения уже на submit, эти коды
 * фиксируют причину вручную принятого решения). */
export const MODERATION_REASON_CODES = [
  "INCOMPLETE_CONTENT",
  "INVALID_PRICE_OR_TERMS",
  "INVALID_MEDIA",
  "MISLEADING_CONTENT",
  "POLICY_VIOLATION",
  "CATEGORY_MISMATCH",
  "DUPLICATE",
  "EXTERNAL_CONTACT_INFO",
  "EXTERNAL_BOOKING_LINK",
  "QR_CODE_OR_CONTACT_MEDIA",
  "DISINTERMEDIATION_ATTEMPT",
  "OTHER",
] as const;
export type ModerationReasonCode = (typeof MODERATION_REASON_CODES)[number];

export interface SubmissionView {
  id: string;
  productId: string;
  productCode: string;
  productTitle: string;
  /** Step 1.4 §7: строка очереди включает partner (владельца Product) и category. */
  productPartnerId: string | null;
  productCategoryId: string | null;
  productCategoryTitle: string | null;
  productVersion: number;
  /** Change proposal: ревизия ProductDraft, проверяемая submission (null — новый Product). */
  draftVersion: number | null;
  submittedBy: { id: string | null; username: string | null };
  submittedAt: Date;
  status: ModerationSubmissionStatus;
  assignedModerator: { id: string | null; username: string | null };
  reviewStartedAt: Date | null;
  decidedAt: Date | null;
  reasonCode: string | null;
  comment: string | null;
  previousSubmissionId: string | null;
  ageMinutes: number;
  snapshot?: ModerationSnapshot | null;
}

export interface ModerationListQuery {
  status?: ModerationSubmissionStatus;
  partnerId?: string;
  categoryId?: string;
  assignedModeratorId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * ModerationService (Phase 1 Step 1.4) — Moderation workflow для Catalog Product.
 *
 * Domain boundary (Step 1.4 §3): Moderation принимает решение по submission/version,
 * НО не становится владельцем Product — все Product transition'ы (submit-lock,
 * release, publish-after-approval) выполняются CatalogService (Catalog остаётся
 * владельцем Product). Moderation НЕ пишет в Product/ProductMedia напрямую.
 *
 * Инварианты:
 *  - решение всегда относится к конкретному submission/productVersion (snapshot immutable);
 *  - PARTNER не может модерировать собственный Product (self-moderation §17);
 *  - только одно финальное решение побеждает (CAS-переходы + partial unique indexes);
 *  - MODERATOR не редактирует Product/Media (нет прав) и не публикует напрямую.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly policy: CatalogAccessPolicy,
    private readonly security: SecurityService,
    private readonly antiDisintermediation: AntiDisintermediationService,
  ) {}

  // ── Submit (PARTNER: свой Product) ─────────────────────────────────────────

  /**
   * Step 1.4 §6: PARTNER submit собственного Product на модерацию.
   * Проверяет ownership, lifecycle, обязательные данные (§6), создаёт immutable
   * snapshot/version, переводит Product в COMPLETE (или оставляет PUBLISHED для
   * change proposal). Повторный submit при активной submission → 409 (conflict).
   */
  async submit(productId: string, actor: AuthUser): Promise<SubmissionView> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanManage(actor, product.partnerId, "catalog.product.submit_moderation");
    if (product.status === "ARCHIVED") {
      throw new ConflictError(`Product ${product.code} is ARCHIVED; cannot submit for moderation`);
    }

    // Одна активная submission на Product (DB-level partial unique index + app-level
    // проверка в tx). Повторный submit до решения → 409.
    const active = await this.prisma.moderationSubmission.count({
      where: { productId, isActiveSubmission: true },
    });
    if (active > 0) throw new ConflictError(`Product ${product.code} already has an active moderation submission`);

    const submissionId = randomUUID();
    let submitted: SubmissionView;
    try {
      submitted = await this.prisma.$transaction(async (tx) => {
        // Step 1.11 §11/§12: deterministic anti-disintermediation scan перед submit —
        // title/description (эффективный контент: draft поверх live) + caption/altText
        // media. Нарушение → controlled validation (ValidationDomainError с перечнем),
        // НЕ silent mutation и НЕ auto-reject: контент не меняется, PARTNER исправляет.
        this.antiDisintermediation.assertNoViolations(await this.contentToScan(tx, productId));

        // Catalog выполняет submit-lock (валидация eligibility + COMPLETE/PUBLISHED lock).
        await this.catalog.lockProductForModeration(tx, productId, actor, submissionId);

        // Immutable snapshot проверяемой версии (build в той же tx). Для change proposal
        // (PUBLISHED + draft) snapshot содержит эффективное содержимое N+1.
        const snapshot = await this.buildSnapshot(tx, productId, actor);

        const row = await tx.moderationSubmission.create({
          data: {
            id: submissionId,
            productId,
            productVersion: snapshot.product.version,
            draftVersion: snapshot.product.draftVersion,
            submittedById: actor.id,
            submittedByUsername: actor.username,
            status: "SUBMITTED",
            isActiveSubmission: true,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            previousSubmissionId: await this.lastSubmissionId(tx, productId),
          },
        });

        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "moderation.submitted",
          resource: "ModerationSubmission",
          resourceId: submissionId,
          details: { productId, productVersion: snapshot.product.version },
        });

        return this.toView(row, snapshot, 0);
      });
    } catch (err) {
      if (this.isUniqueActiveViolation(err)) {
        throw new ConflictError(`Product ${product.code} already has an active moderation submission`);
      }
      throw err;
    }
    await this.catalog.publishPendingEvents();
    return submitted;
  }

  // ── Queue / reads ──────────────────────────────────────────────────────────

  /**
   * Step 1.4 §7: moderation queue — server-side pagination/filtering/sorting.
   * PARTNER не получает queue (guard требует moderation.review).
   */
  async list(query: ModerationListQuery): Promise<{ items: SubmissionView[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.ModerationSubmissionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.assignedModeratorId ? { assignedModeratorId: query.assignedModeratorId } : {}),
      // partnerId/categoryId — связанные поля Product (server-side filter).
      ...(query.partnerId || query.categoryId
        ? {
            product: {
              ...(query.partnerId ? { partnerId: query.partnerId } : {}),
              ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.moderationSubmission.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: { select: { code: true, title: true, partnerId: true, categoryId: true, category: { select: { title: true } } } } },
      }),
      this.prisma.moderationSubmission.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toView(r, null, this.ageMinutes(r.submittedAt))),
      total,
      page,
      pageSize,
    };
  }

  /** Step 1.4 §7: детали submission (с snapshot). MODERATOR — moderation.review. */
  async getById(id: string): Promise<SubmissionView> {
    const row = await this.prisma.moderationSubmission.findUnique({
      where: { id },
      include: { product: { select: { code: true, title: true } } },
    });
    if (!row) throw new NotFoundError(`Moderation submission ${id} not found`);
    return this.toView(row, row.snapshot as unknown as ModerationSnapshot | null, this.ageMinutes(row.submittedAt));
  }

  /** Step 1.4 §16/§20: PARTNER читает СВОЙ history moderation; MODERATOR — любой. */
  async historyForProduct(productId: string, actor: AuthUser): Promise<SubmissionView[]> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, partnerId: true } });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    this.policy.assertCanRead(actor, product.partnerId);
    const rows = await this.prisma.moderationSubmission.findMany({
      where: { productId },
      orderBy: { submittedAt: "desc" },
      include: { product: { select: { code: true, title: true } } },
    });
    return rows.map((r) => this.toView(r, null, this.ageMinutes(r.submittedAt)));
  }

  // ── Assignment / start review ──────────────────────────────────────────────

  /** Step 1.4 §8: назначение submission на модератора (unassigned → assigned). */
  async assign(id: string, moderatorId: string, actor: AuthUser): Promise<SubmissionView> {
    const moderator = await this.prisma.user.findUnique({ where: { id: moderatorId } });
    if (!moderator) throw new NotFoundError(`Moderator user ${moderatorId} not found`);
    const row = await this.prisma.moderationSubmission.findUnique({ where: { id } });
    if (!row) throw new NotFoundError(`Moderation submission ${id} not found`);
    if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") {
      throw new ConflictError(`Cannot assign: submission is ${row.status}`);
    }
    const updated = await this.prisma.moderationSubmission.update({
      where: { id },
      data: { assignedModeratorId: moderator.id, assignedModeratorUsername: moderator.username },
      include: { product: { select: { code: true, title: true } } },
    });
    await this.security.audit(this.prisma as unknown as Prisma.TransactionClient, {
      userId: actor.id,
      username: actor.username,
      action: "moderation.assigned",
      resource: "ModerationSubmission",
      resourceId: id,
      details: { productId: row.productId, moderatorId },
    });
    return this.toView(updated, null, this.ageMinutes(updated.submittedAt));
  }

  /**
   * Step 1.4 §8: start review — только из SUBMITTED; фиксирует reviewer + timestamp;
   * переводит в IN_REVIEW. Повторный start → idempotent (тот же модератор) или
   * conflict (чужой активный review нельзя перехватить незаметно).
   */
  async startReview(id: string, actor: AuthUser): Promise<SubmissionView> {
    const row = await this.prisma.moderationSubmission.findUnique({ where: { id } });
    if (!row) throw new NotFoundError(`Moderation submission ${id} not found`);

    if (row.status === "IN_REVIEW") {
      if (row.assignedModeratorId === actor.id) {
        // Idempotent retry: тот же модератор уже начал review.
        return this.getById(id);
      }
      throw new ConflictError("Review already started by another moderator");
    }
    if (row.status !== "SUBMITTED") {
      throw new ConflictError(`Cannot start review: submission is ${row.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // CAS: только SUBMITTED → IN_REVIEW; проигравший конкурент получает conflict.
      const res = await tx.moderationSubmission.updateMany({
        where: { id, status: "SUBMITTED" },
        data: {
          status: "IN_REVIEW",
          isActiveSubmission: true,
          assignedModeratorId: row.assignedModeratorId ?? actor.id,
          assignedModeratorUsername: row.assignedModeratorUsername ?? actor.username,
          reviewStartedAt: new Date(),
        },
      });
      if (res.count === 0) {
        const fresh = await tx.moderationSubmission.findUnique({ where: { id } });
        if (fresh?.status === "IN_REVIEW") {
          throw new ConflictError("Review already started by another moderator");
        }
        throw new ConflictError(`Cannot start review: submission is ${fresh?.status}`);
      }
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "moderation.review_started",
        resource: "ModerationSubmission",
        resourceId: id,
        details: { productId: row.productId, productVersion: row.productVersion },
      });
      return tx.moderationSubmission.findUniqueOrThrow({ where: { id }, include: { product: { select: { code: true, title: true } } } });
    });
    return this.toView(updated, null, this.ageMinutes(updated.submittedAt));
  }

  // ── Decisions (approve/reject/request_changes) ─────────────────────────────

  /**
   * Step 1.4 §9: approve — CAS из SUBMITTED/IN_REVIEW → APPROVED; фиксирует
   * reviewer/decision/timestamp; вызывает controlled Catalog publish transition.
   * Idempotent retry (уже APPROVED) → тот же результат, без второго publish.
   * Concurrent approve/approve или approve/reject → побеждает ровно один.
   */
  async approve(id: string, actor: AuthUser): Promise<SubmissionView> {
    return this.decide(id, actor, "APPROVED", async (tx, row) => {
      const product = await tx.product.findUnique({
        where: { id: row.productId },
        select: { id: true, partnerId: true, version: true, draft: { select: { version: true } } },
      });
      if (!product) throw new NotFoundError(`Product ${row.productId} not found`);
      this.assertNoSelfModeration(actor, product.partnerId);
      // Stale version guard (§18/§27): публикуем ровно проверенную версию.
      if (product.version !== row.productVersion) {
        throw new ConflictError(
          `Submission is stale: product version ${product.version} != reviewed version ${row.productVersion}; re-submit required`,
        );
      }
      // Change proposal: ревизия draft не должна расходиться с проверенной (submitted
      // proposal нельзя silent-edit; draft.version инкрементируется на каждую правку).
      if (row.draftVersion !== null && (product.draft?.version ?? null) !== row.draftVersion) {
        throw new ConflictError(
          `Submission is stale: change proposal revision ${product.draft?.version ?? "<none>"} != reviewed revision ${row.draftVersion}; re-submit required`,
        );
      }
      await this.catalog.publishAfterModerationApproval(tx, row.productId, actor, row.id);
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "moderation.approved",
        resource: "ModerationSubmission",
        resourceId: row.id,
        details: { productId: row.productId, productVersion: row.productVersion, draftVersion: row.draftVersion, submissionId: row.id },
      });
      return tx.moderationSubmission.findUniqueOrThrow({ where: { id: row.id }, include: { product: { select: { code: true, title: true } } } });
    });
  }

  /** Step 1.4 §10: reject — stable reasonCode обязателен (OTHER требует comment). */
  async reject(id: string, actor: AuthUser, reasonCode: string, comment?: string): Promise<SubmissionView> {
    this.assertReasonCode(reasonCode, comment);
    return this.decide(id, actor, "REJECTED", async (tx, row) => {
      const product = await tx.product.findUnique({ where: { id: row.productId }, select: { id: true, partnerId: true } });
      if (!product) throw new NotFoundError(`Product ${row.productId} not found`);
      this.assertNoSelfModeration(actor, product.partnerId);
      await this.catalog.releaseProductForModeration(tx, row.productId, actor, row.id, "moderation.rejected", comment);
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "moderation.rejected",
        resource: "ModerationSubmission",
        resourceId: row.id,
        details: { productId: row.productId, productVersion: row.productVersion, reasonCode, comment: comment ?? null },
      });
      return tx.moderationSubmission.findUniqueOrThrow({ where: { id: row.id }, include: { product: { select: { code: true, title: true } } } });
    }, reasonCode, comment);
  }

  /** Step 1.4 §11: request_changes — reason + comment; PARTNER снова может edit + re-submit. */
  async requestChanges(id: string, actor: AuthUser, reasonCode: string, comment?: string): Promise<SubmissionView> {
    this.assertReasonCode(reasonCode, comment);
    return this.decide(id, actor, "CHANGES_REQUESTED", async (tx, row) => {
      const product = await tx.product.findUnique({ where: { id: row.productId }, select: { id: true, partnerId: true } });
      if (!product) throw new NotFoundError(`Product ${row.productId} not found`);
      this.assertNoSelfModeration(actor, product.partnerId);
      await this.catalog.releaseProductForModeration(tx, row.productId, actor, row.id, "moderation.changes_requested", comment);
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "moderation.changes_requested",
        resource: "ModerationSubmission",
        resourceId: row.id,
        details: { productId: row.productId, productVersion: row.productVersion, reasonCode, comment: comment ?? null },
      });
      return tx.moderationSubmission.findUniqueOrThrow({ where: { id: row.id }, include: { product: { select: { code: true, title: true } } } });
    }, reasonCode, comment);
  }

  /**
   * Общий CAS-переход решения: только SUBMITTED/IN_REVIEW → финальное состояние.
   * Если уже в финальном состоянии — idempotent (тот же результат, без побочных
   * эффектов: второй approve не создаёт второй publish). Противоположное решение
   * или stale → ConflictError.
   */
  private async decide(
    id: string,
    actor: AuthUser,
    target: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
    apply: (tx: Prisma.TransactionClient, row: { id: string; productId: string; productVersion: number; draftVersion: number | null }) => Promise<unknown>,
    reasonCode?: string,
    comment?: string,
  ): Promise<SubmissionView> {
    const row = await this.prisma.moderationSubmission.findUnique({ where: { id } });
    if (!row) throw new NotFoundError(`Moderation submission ${id} not found`);

    // Idempotent retry: уже принято то же решение → возвращаем результат без эффектов.
    if (row.status === target) {
      return this.getById(id);
    }
    if (row.status === "APPROVED" || row.status === "REJECTED" || row.status === "CHANGES_REQUESTED") {
      throw new ConflictError(`Cannot decide: submission is already ${row.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.moderationSubmission.updateMany({
        where: { id, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
        data: {
          status: target,
          isActiveSubmission: false,
          decidedAt: new Date(),
          assignedModeratorId: row.assignedModeratorId ?? actor.id,
          assignedModeratorUsername: row.assignedModeratorUsername ?? actor.username,
          reasonCode: reasonCode ?? null,
          comment: comment ?? null,
        },
      });
      if (res.count === 0) {
        const fresh = await tx.moderationSubmission.findUnique({ where: { id } });
        if (fresh?.status === target) return tx.moderationSubmission.findUniqueOrThrow({ where: { id }, include: { product: { select: { code: true, title: true } } } });
        throw new ConflictError(`Cannot decide: submission is ${fresh?.status}`);
      }
      // Только победитель CAS выполняет бизнес-эффект (publish / release / audit).
      await apply(tx, { id: row.id, productId: row.productId, productVersion: row.productVersion, draftVersion: row.draftVersion ?? null });
      return tx.moderationSubmission.findUniqueOrThrow({ where: { id }, include: { product: { select: { code: true, title: true } } } });
    });
    await this.catalog.publishPendingEvents();
    return this.toView(updated, null, this.ageMinutes(updated.submittedAt));
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Step 1.4 §14: immutable snapshot проверяемой версии (без storage keys/secrets).
   * Step 1.4 review fix 1: для change proposal (PUBLISHED + ProductDraft) snapshot
   * содержит ЭФФЕКТИВНОЕ содержимое N+1 (draft поверх live) + tariffs draft + ревизию
   * draft. targetVersion = live N + 1 (версия после approve).
   */
  private async buildSnapshot(tx: Prisma.TransactionClient, productId: string, actor: AuthUser): Promise<ModerationSnapshot> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { slug: true } },
        tariffs: { orderBy: { createdAt: "asc" } },
        availability: { orderBy: { date: "asc" }, take: 60 },
        media: { orderBy: { sortOrder: "asc" }, where: { status: { not: "ARCHIVED" } } },
        draft: true,
      },
    });
    if (!product) throw new NotFoundError(`Product ${productId} not found`);

    const draft = product.draft;
    const changeProposal = draft !== null;
    const effectiveTitle = draft?.title ?? product.title;
    const effectiveDescription = draft?.description !== undefined ? draft.description : product.description;
    const effectiveCategoryId = draft?.categoryId !== undefined ? draft.categoryId : product.categoryId;
    const effectiveCategorySchemaId = draft?.categorySchemaId !== undefined ? draft.categorySchemaId : product.categorySchemaId;
    const effectiveAttributes = draft?.attributes !== undefined ? draft.attributes : product.attributes;

    // Тарифы N+1: draft.tariffs (payload) либо live tariffs.
    const draftTariffs = (draft?.tariffs ?? null) as Array<{ name: string; price: number | string; currency?: string }> | null;
    const effectiveTariffs = draftTariffs
      ? draftTariffs.map((t, i) => ({
          id: `draft-${i + 1}`,
          name: t.name,
          price: String(t.price),
          currency: t.currency ?? "USD",
          validFrom: null,
          validTo: null,
        }))
      : product.tariffs.map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price.toString(),
          currency: t.currency,
          validFrom: t.validFrom,
          validTo: t.validTo,
        }));

    return {
      schemaVersion: 1,
      product: {
        id: product.id,
        code: product.code,
        type: product.type,
        title: effectiveTitle,
        slug: product.slug,
        description: effectiveDescription,
        version: product.version,
        targetVersion: product.version + 1,
        status: product.status,
        categoryId: effectiveCategoryId,
        categorySlug: draft?.categoryId && draft.categoryId !== product.categoryId ? null : (product.category?.slug ?? null),
        categorySchemaId: effectiveCategorySchemaId,
        attributes: (effectiveAttributes ?? null) as Prisma.JsonValue | null,
        partnerId: product.partnerId,
        changeProposal,
        draftVersion: draft?.version ?? null,
      },
      tariffs: effectiveTariffs,
      availability: product.availability.map((a) => ({
        id: a.id,
        tariffId: a.tariffId,
        date: a.date,
        slotsTotal: a.slotsTotal,
        slotsBooked: a.slotsBooked,
        slotsReserved: a.slotsReserved,
      })),
      media: product.media.map((m) => ({
        id: m.id,
        type: m.type,
        mimeType: m.mimeType,
        size: m.size,
        width: m.width,
        height: m.height,
        sortOrder: m.sortOrder,
        isPrimary: m.isPrimary,
        caption: m.caption,
        altText: m.altText,
        status: m.status,
        originalFileName: m.originalFileName,
      })),
      primaryMediaId: product.media.find((m) => m.isPrimary)?.id ?? null,
      submittedBy: actor.username,
    };
  }

  /**
   * Step 1.11: free-text поля, сканируемые детектором anti-disintermediation.
   * Эффективный контент = draft (N+1) поверх live, как в snapshot. Media — все
   * не-ARCHIVED (включая staged DRAFT для change proposal).
   */
  private async contentToScan(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<Array<{ value: string | null | undefined; field: string }>> {
    const row = await tx.product.findUnique({
      where: { id: productId },
      select: {
        title: true,
        description: true,
        draft: { select: { title: true, description: true } },
        media: { where: { status: { not: "ARCHIVED" } }, select: { caption: true, altText: true } },
      },
    });
    if (!row) return [];
    const fields: Array<{ value: string | null | undefined; field: string }> = [
      { value: row.draft?.title ?? row.title, field: "title" },
      {
        value: row.draft?.description !== undefined ? row.draft.description : row.description,
        field: "description",
      },
    ];
    for (const [i, m] of row.media.entries()) {
      if (m.caption) fields.push({ value: m.caption, field: `caption#${i + 1}` });
      if (m.altText) fields.push({ value: m.altText, field: `altText#${i + 1}` });
    }
    return fields;
  }

  private async lastSubmissionId(tx: Prisma.TransactionClient, productId: string): Promise<string | null> {
    const last = await tx.moderationSubmission.findFirst({
      where: { productId },
      orderBy: { submittedAt: "desc" },
      select: { id: true },
    });
    return last?.id ?? null;
  }

  /** Step 1.4 §17: self-moderation protection (actor/resource level, не только role). */
  private assertNoSelfModeration(actor: AuthUser, productPartnerId: string | null): void {
    if (actor.partnerId !== null && productPartnerId !== null && actor.partnerId === productPartnerId) {
      throw new ForbiddenException("Self-moderation is forbidden: PARTNER cannot moderate their own product");
    }
  }

  private assertReasonCode(reasonCode: string, comment?: string): void {
    if (!(MODERATION_REASON_CODES as readonly string[]).includes(reasonCode)) {
      throw new ValidationDomainError(`Invalid reasonCode; allowed: ${MODERATION_REASON_CODES.join(", ")}`);
    }
    if (reasonCode === "OTHER" && !comment?.trim()) {
      throw new ValidationDomainError("reasonCode OTHER requires a comment");
    }
  }

  private ageMinutes(submittedAt: Date): number {
    return Math.max(0, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 60000));
  }

  private isUniqueActiveViolation(err: unknown): boolean {
    // Единый DB-level инвариант активной submission (Step 1.4 review fix 2).
    return (
      (err as { code?: string })?.code === "P2002" &&
      String((err as { meta?: { target?: unknown } })?.meta?.target ?? "").includes("one_active_per_product")
    );
  }

  private toView(row: {
    id: string;
    productId: string;
    productVersion: number;
    draftVersion: number | null;
    submittedById: string | null;
    submittedByUsername: string | null;
    submittedAt: Date;
    status: ModerationSubmissionStatus;
    assignedModeratorId: string | null;
    assignedModeratorUsername: string | null;
    reviewStartedAt: Date | null;
    decidedAt: Date | null;
    reasonCode: string | null;
    comment: string | null;
    previousSubmissionId: string | null;
    snapshot: unknown;
    product?: { code?: string; title?: string; partnerId?: string | null; categoryId?: string | null; category?: { title?: string } | null };
  }, snapshot: ModerationSnapshot | null, ageMinutes: number): SubmissionView {
    return {
      id: row.id,
      productId: row.productId,
      productCode: row.product?.code ?? "",
      productTitle: row.product?.title ?? "",
      productPartnerId: row.product?.partnerId ?? null,
      productCategoryId: row.product?.categoryId ?? null,
      productCategoryTitle: row.product?.category?.title ?? null,
      productVersion: row.productVersion,
      draftVersion: row.draftVersion ?? null,
      submittedBy: { id: row.submittedById, username: row.submittedByUsername },
      submittedAt: row.submittedAt,
      status: row.status,
      assignedModerator: { id: row.assignedModeratorId, username: row.assignedModeratorUsername },
      reviewStartedAt: row.reviewStartedAt,
      decidedAt: row.decidedAt,
      reasonCode: row.reasonCode,
      comment: row.comment,
      previousSubmissionId: row.previousSubmissionId,
      ageMinutes,
      snapshot: snapshot ?? (row.snapshot as ModerationSnapshot | null),
    };
  }
}
