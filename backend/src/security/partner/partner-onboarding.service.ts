import { Injectable } from "@nestjs/common";
import type { Prisma, ApplicantType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { IdsService } from "../../shared/ids.service";
import { CrmService, type CreateOrLinkPartnerInput } from "../../modules/crm/crm.service";
import { SecurityService } from "../security.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { normalizeEmail } from "../../shared/field-validation";
import { PartnerApplicationStatus } from "../../generated/prisma/enums";
import type { AuthUser } from "../auth/auth.service";

/** Поля, которые заявитель может менять в СВОЕЙ DRAFT/CHANGES_REQUESTED заявке. */
export interface UpdateOwnApplicationInput {
  legalName?: string;
  brandName?: string;
  country?: string;
  registrationNumber?: string;
  taxId?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  businessDescription?: string;
  serviceCategories?: string[];
}

/** Вход публичной регистрации (создаёт DRAFT). */
export interface CreateApplicationInput {
  applicantType: ApplicantType;
  termsAccepted: boolean;
  brandName: string;
  country: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  businessDescription?: string;
  serviceCategories?: string[];
}

export interface ReviewQueueQuery {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const EDITABLE_STATUSES: PartnerApplicationStatus[] = [PartnerApplicationStatus.DRAFT, PartnerApplicationStatus.CHANGES_REQUESTED];
const QUEUE_STATUSES: PartnerApplicationStatus[] = [PartnerApplicationStatus.SUBMITTED, PartnerApplicationStatus.IN_REVIEW];

/**
 * PHASE 1 STEP 1.10 — Partner Registration & Onboarding (security-owned).
 *
 * Владелец: security.* (PartnerApplication — onboarding identity). crm.Partner
 * создаётся/линкуется ТОЛЬКО на approve через CRM-owned service
 * (CrmService.createOrLinkPartner) — orchestration задокументирована ADR-0004
 * (отдельный разрешённый contract, НЕ наследует ADR-0003 Buyer exception).
 *
 * Инвариант (Step 1.10 §7):
 *   Partner selling capabilities ⇒ approved onboarding ⇒ valid User.partnerId
 *   ⇒ existing CRM Partner.
 * Регистрация ≠ approval ≠ Product moderation ≠ Payment/KYC.
 */
@Injectable()
export class PartnerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly crm: CrmService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Application journal + audit ───────────────────────────────────────────

  private async journal(
    tx: Prisma.TransactionClient,
    applicationId: string,
    action: string,
    opts: { from?: string; to?: string; comment?: string; fields?: Record<string, unknown>; actorId?: string | null; actorName?: string | null },
  ): Promise<void> {
    await tx.partnerApplicationHistory.create({
      data: {
        applicationId,
        action,
        from: opts.from ?? null,
        to: opts.to ?? null,
        comment: opts.comment ?? null,
        fields: (opts.fields ?? undefined) as Prisma.InputJsonValue | undefined,
        actorId: opts.actorId ?? null,
        actorName: opts.actorName ?? null,
      },
    });
  }

  private audit(
    tx: Prisma.TransactionClient | undefined,
    entry: Parameters<SecurityService["audit"]>[1],
  ): Promise<void> {
    return this.security.audit(tx, entry);
  }

  // ── Create (public registration, внутри tx AuthService.registerPartner) ───

  async createApplication(
    tx: Prisma.TransactionClient,
    userId: string,
    input: CreateApplicationInput,
  ): Promise<{ id: string; code: string }> {
    const existing = await tx.partnerApplication.findFirst({ where: { userId } });
    if (existing) throw new ConflictError("User already has a partner application");

    const code = await this.ids.nextCode(tx, "APP");
    const app = await tx.partnerApplication.create({
      data: {
        code,
        userId,
        status: PartnerApplicationStatus.DRAFT,
        applicantType: input.applicantType,
        legalName: input.legalName ?? null,
        brandName: input.brandName,
        country: input.country,
        registrationNumber: input.registrationNumber ?? null,
        taxId: input.taxId ?? null,
        website: input.website ?? null,
        contactEmail: normalizeEmail(input.contactEmail ?? ""),
        contactPhone: input.contactPhone ?? null,
        address: input.address ?? null,
        businessDescription: input.businessDescription ?? null,
        serviceCategories: (input.serviceCategories && input.serviceCategories.length > 0 ? input.serviceCategories : undefined) as Prisma.InputJsonValue | undefined,
        termsAccepted: input.termsAccepted === true,
        version: 1,
      },
      select: { id: true, code: true },
    });

    await this.journal(tx, app.id, "created", {
      to: PartnerApplicationStatus.DRAFT,
      actorId: userId,
      comment: "Partner registration (public /become-a-partner)",
    });
    return app;
  }

  // ── Own application ───────────────────────────────────────────────────────

  /** Собственная заявка (own-scope из JWT). null — legacy PARTNER без заявки. */
  async getOwnApplication(userId: string) {
    const app = await this.prisma.partnerApplication.findFirst({
      where: { userId },
      include: { history: { orderBy: { createdAt: "desc" }, take: 100 } },
    });
    if (!app) return null;
    return { ...app, editable: EDITABLE_STATUSES.includes(app.status) };
  }

  /** Правка СВОЕЙ заявки: только DRAFT/CHANGES_REQUESTED + optimistic lock. */
  async updateOwnApplication(userId: string, input: UpdateOwnApplicationInput, expectedVersion: number) {
    const app = await this.prisma.partnerApplication.findFirst({ where: { userId } });
    if (!app) throw new NotFoundError("Partner application not found");
    if (!EDITABLE_STATUSES.includes(app.status)) {
      throw new ConflictError(
        `Application is ${app.status}; only ${EDITABLE_STATUSES.join("/")} are editable`,
      );
    }
    if (app.version !== expectedVersion) {
      throw new ConflictError("Application version mismatch (stale edit) — reload and retry");
    }

    const data = this.buildUpdateData(input, app);
    const updated = await this.prisma.partnerApplication.updateMany({
      where: { id: app.id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new ConflictError("Application version mismatch (stale edit) — reload and retry");
    }

    await this.journal(this.prisma as unknown as Prisma.TransactionClient, app.id, "updated", {
      from: app.status,
      to: app.status,
      actorId: userId,
      fields: { changed: Object.keys(data) },
      comment: "Заявитель обновил заявку",
    });
    await this.audit(undefined, {
      userId,
      action: "partner_application.updated",
      resource: "PartnerApplication",
      resourceId: app.id,
      details: { fields: Object.keys(data) },
    });

    return this.getOwnApplication(userId);
  }

  /** Submit: DRAFT/CHANGES_REQUESTED → SUBMITTED (с полной валидацией). */
  async submitOwnApplication(userId: string) {
    const app = await this.prisma.partnerApplication.findFirst({ where: { userId } });
    if (!app) throw new NotFoundError("Partner application not found");
    if (!EDITABLE_STATUSES.includes(app.status)) {
      throw new ConflictError(
        `Application is ${app.status}; only ${EDITABLE_STATUSES.join("/")} can be submitted`,
      );
    }
    await this.validateForSubmit(app);

    const updated = await this.prisma.partnerApplication.updateMany({
      where: { id: app.id, status: { in: EDITABLE_STATUSES } },
      data: {
        status: PartnerApplicationStatus.SUBMITTED,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        reviewedByUsername: null,
        decisionReason: null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new ConflictError("Concurrent submit: application is no longer editable");
    }

    await this.journal(this.prisma as unknown as Prisma.TransactionClient, app.id, "submitted", {
      from: app.status,
      to: PartnerApplicationStatus.SUBMITTED,
      actorId: userId,
      comment: "Заявка отправлена на review",
    });
    await this.audit(undefined, {
      userId,
      username: undefined,
      action: "partner_application.submitted",
      resource: "PartnerApplication",
      resourceId: app.id,
    });

    return this.getOwnApplication(userId);
  }

  // ── Internal review queue ─────────────────────────────────────────────────

  async listReviewQueue(query: ReviewQueueQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const statusFilter = query.status ? [query.status as PartnerApplicationStatus] : QUEUE_STATUSES;
    const where: Prisma.PartnerApplicationWhereInput = {
      status: { in: statusFilter },
      ...(query.search
        ? {
            OR: [
              { user: { username: { contains: query.search, mode: "insensitive" } } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
              { brandName: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.partnerApplication.findMany({
        where,
        orderBy: { submittedAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, username: true, email: true } } },
      }),
      this.prisma.partnerApplication.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Деталь заявки для ревьюера (application + история + заявитель). */
  async getReviewApplication(id: string) {
    const app = await this.prisma.partnerApplication.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, email: true, status: true } },
        history: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!app) throw new NotFoundError(`PartnerApplication ${id} not found`);
    return app;
  }

  /** Start review: SUBMITTED → IN_REVIEW (CAS; retry-safe для того же ревьюера). */
  async startReview(applicationId: string, reviewer: AuthUser) {
    const app = await this.prisma.partnerApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundError(`PartnerApplication ${applicationId} not found`);
    this.assertNotSelfReview(app.userId, reviewer);
    if (app.status === PartnerApplicationStatus.IN_REVIEW) {
      if (app.reviewedById === reviewer.id) return this.getReviewApplication(applicationId);
      throw new ConflictError("Application is already IN_REVIEW by another reviewer");
    }
    if (app.status !== PartnerApplicationStatus.SUBMITTED) {
      throw new ConflictError(`Application is ${app.status}; only SUBMITTED can be started for review`);
    }

    const updated = await this.prisma.partnerApplication.updateMany({
      where: { id: applicationId, status: PartnerApplicationStatus.SUBMITTED },
      data: {
        status: PartnerApplicationStatus.IN_REVIEW,
        reviewedAt: new Date(),
        reviewedById: reviewer.id,
        reviewedByUsername: reviewer.username,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new ConflictError("Concurrent decision: application is no longer SUBMITTED");
    }

    await this.journal(this.prisma as unknown as Prisma.TransactionClient, applicationId, "review_started", {
      from: PartnerApplicationStatus.SUBMITTED,
      to: PartnerApplicationStatus.IN_REVIEW,
      actorId: reviewer.id,
      actorName: reviewer.username,
      comment: "Ревью начато",
    });
    await this.audit(undefined, {
      userId: reviewer.id,
      username: reviewer.username,
      action: "partner_application.review_started",
      resource: "PartnerApplication",
      resourceId: applicationId,
    });
    return this.getReviewApplication(applicationId);
  }

  /**
   * Approve (Step 1.10 §15): валидация → CRM create-or-link Partner (CRM-owned)
   * → User.partnerId → APPROVED → audit → journal. Всё в ОДНОЙ транзакции
   * (ADR-0004: explicit approved contract для Security↔CRM orchestration).
   * CAS по status=IN_REVIEW → только одно решение побеждает; retry идемпотентен.
   */
  async approveApplication(applicationId: string, reviewer: AuthUser, reason?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const app = await tx.partnerApplication.findUnique({ where: { id: applicationId } });
      if (!app) throw new NotFoundError(`PartnerApplication ${applicationId} not found`);
      this.assertNotSelfReview(app.userId, reviewer);

      // Retry-safe: повторный approve уже APPROVED-заявки — no-op (без duplicate Partner).
      if (app.status === PartnerApplicationStatus.APPROVED) {
        return { applicationId, status: PartnerApplicationStatus.APPROVED, partnerId: app.partnerId, alreadyApproved: true };
      }
      if (app.status !== PartnerApplicationStatus.IN_REVIEW) {
        throw new ConflictError(
          `Application is ${app.status}; only IN_REVIEW can be approved (one final decision)`,
        );
      }
      // Повторная валидация перед активацией (defense in depth).
      await this.validateForSubmit(app);

      // CAS decision ПЕРВЫМ: единственный победитель при concurrent approve/reject
      // (проигравший падает на CAS с чистым 409 и НЕ доходит до создания Partner).
      const decided = await tx.partnerApplication.updateMany({
        where: { id: applicationId, status: PartnerApplicationStatus.IN_REVIEW },
        data: {
          status: PartnerApplicationStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: reviewer.id,
          reviewedByUsername: reviewer.username,
          decisionReason: reason ?? null,
          version: { increment: 1 },
        },
      });
      if (decided.count === 0) {
        throw new ConflictError("Concurrent decision: application is no longer IN_REVIEW");
      }

      // CRM-owned create-or-link (deterministic по authoritative key, no merge по имени).
      const partnerInput: CreateOrLinkPartnerInput = {
        name: app.brandName,
        contactEmail: app.applicantType === "INDIVIDUAL" ? app.contactEmail : undefined,
        registrationNumber: app.applicantType === "COMPANY" ? (app.registrationNumber ?? undefined) : undefined,
        taxId: app.taxId ?? undefined,
        countryCode: app.country ?? undefined,
        actorUserId: reviewer.id,
      };
      const { partnerId, created } = await this.crm.createOrLinkPartner(tx, partnerInput);

      // Controlled User.partnerId (security пишет только security.User).
      await tx.user.update({ where: { id: app.userId }, data: { partnerId } });
      // Reference на заявке (retry-safe: повторный approve возвращает partnerId).
      await tx.partnerApplication.update({ where: { id: applicationId }, data: { partnerId } });

      await this.journal(tx, applicationId, "approved", {
        from: PartnerApplicationStatus.IN_REVIEW,
        to: PartnerApplicationStatus.APPROVED,
        actorId: reviewer.id,
        actorName: reviewer.username,
        fields: { partnerId, partnerCreated: created, reason: reason ?? null },
        comment: created ? "Партнёр создан и активирован" : "Партнёр переиспользован (deterministic link)",
      });
      await this.audit(tx, {
        userId: reviewer.id,
        username: reviewer.username,
        action: "partner_application.approved",
        resource: "PartnerApplication",
        resourceId: applicationId,
        details: { applicantUserId: app.userId, partnerId, partnerCreated: created },
      });
      await this.audit(tx, {
        userId: reviewer.id,
        username: reviewer.username,
        action: "partner.created_or_linked",
        resource: "Partner",
        resourceId: partnerId,
        details: { applicationId, created, source: "partner_onboarding" },
      });
      await this.audit(tx, {
        userId: reviewer.id,
        username: reviewer.username,
        action: "user.partner_linked",
        resource: "User",
        resourceId: app.userId,
        details: { partnerId, applicationId },
      });

      return { applicationId, status: PartnerApplicationStatus.APPROVED, partnerId, partnerCreated: created };
    });

    // Публикация outbox (PartnerCreated из approve-транзакции) после коммита.
    await this.eventBus.publishPending();
    return result;
  }

  /** Reject: IN_REVIEW → REJECTED (reason обязателен, CAS, retry-safe). */
  async rejectApplication(applicationId: string, reviewer: AuthUser, reason: string) {
    const trimmed = (reason ?? "").trim();
    if (trimmed.length < 3) throw new ValidationDomainError("Rejection reason is required (min 3 chars)");

    const result = await this.prisma.$transaction(async (tx) => {
      const app = await tx.partnerApplication.findUnique({ where: { id: applicationId } });
      if (!app) throw new NotFoundError(`PartnerApplication ${applicationId} not found`);
      this.assertNotSelfReview(app.userId, reviewer);
      if (app.status === PartnerApplicationStatus.REJECTED) {
        return { applicationId, status: PartnerApplicationStatus.REJECTED, alreadyRejected: true };
      }
      if (app.status !== PartnerApplicationStatus.IN_REVIEW) {
        throw new ConflictError(`Application is ${app.status}; only IN_REVIEW can be rejected`);
      }

      const decided = await tx.partnerApplication.updateMany({
        where: { id: applicationId, status: PartnerApplicationStatus.IN_REVIEW },
        data: {
          status: PartnerApplicationStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedById: reviewer.id,
          reviewedByUsername: reviewer.username,
          decisionReason: trimmed,
          version: { increment: 1 },
        },
      });
      if (decided.count === 0) {
        throw new ConflictError("Concurrent decision: application is no longer IN_REVIEW");
      }

      await this.journal(tx, applicationId, "rejected", {
        from: PartnerApplicationStatus.IN_REVIEW,
        to: PartnerApplicationStatus.REJECTED,
        actorId: reviewer.id,
        actorName: reviewer.username,
        fields: { reason: trimmed },
        comment: trimmed,
      });
      await this.audit(tx, {
        userId: reviewer.id,
        username: reviewer.username,
        action: "partner_application.rejected",
        resource: "PartnerApplication",
        resourceId: applicationId,
        details: { applicantUserId: app.userId, reason: trimmed },
      });
      return { applicationId, status: PartnerApplicationStatus.REJECTED };
    });

    await this.eventBus.publishPending();
    return result;
  }

  /** Request changes: IN_REVIEW → CHANGES_REQUESTED (reason обязателен, CAS). */
  async requestChanges(applicationId: string, reviewer: AuthUser, reason: string) {
    const trimmed = (reason ?? "").trim();
    if (trimmed.length < 3) throw new ValidationDomainError("Change request reason is required (min 3 chars)");

    const result = await this.prisma.$transaction(async (tx) => {
      const app = await tx.partnerApplication.findUnique({ where: { id: applicationId } });
      if (!app) throw new NotFoundError(`PartnerApplication ${applicationId} not found`);
      this.assertNotSelfReview(app.userId, reviewer);
      if (app.status !== PartnerApplicationStatus.IN_REVIEW) {
        throw new ConflictError(`Application is ${app.status}; only IN_REVIEW can be sent back for changes`);
      }

      const decided = await tx.partnerApplication.updateMany({
        where: { id: applicationId, status: PartnerApplicationStatus.IN_REVIEW },
        data: {
          status: PartnerApplicationStatus.CHANGES_REQUESTED,
          reviewedAt: new Date(),
          reviewedById: reviewer.id,
          reviewedByUsername: reviewer.username,
          decisionReason: trimmed,
          version: { increment: 1 },
        },
      });
      if (decided.count === 0) {
        throw new ConflictError("Concurrent decision: application is no longer IN_REVIEW");
      }

      await this.journal(tx, applicationId, "changes_requested", {
        from: PartnerApplicationStatus.IN_REVIEW,
        to: PartnerApplicationStatus.CHANGES_REQUESTED,
        actorId: reviewer.id,
        actorName: reviewer.username,
        fields: { reason: trimmed },
        comment: trimmed,
      });
      await this.audit(tx, {
        userId: reviewer.id,
        username: reviewer.username,
        action: "partner_application.changes_requested",
        resource: "PartnerApplication",
        resourceId: applicationId,
        details: { applicantUserId: app.userId, reason: trimmed },
      });
      return { applicationId, status: PartnerApplicationStatus.CHANGES_REQUESTED };
    });

    await this.eventBus.publishPending();
    return result;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private assertNotSelfReview(applicantUserId: string, reviewer: AuthUser): void {
    // Self-approval protection (§23): даже multi-role аккаунт не может решить
    // собственную заявку — объектный конфликт по userId.
    if (applicantUserId === reviewer.id) {
      throw new ForbiddenError("Reviewer cannot review their own partner application (self-approval is not allowed)");
    }
  }

  private buildUpdateData(
    input: UpdateOwnApplicationInput,
    app: { contactEmail: string },
  ): Prisma.PartnerApplicationUpdateManyMutationInput {
    const data: Prisma.PartnerApplicationUpdateManyMutationInput = {};
    if (input.legalName !== undefined) data.legalName = input.legalName;
    if (input.brandName !== undefined) data.brandName = input.brandName;
    if (input.country !== undefined) data.country = input.country;
    if (input.registrationNumber !== undefined) data.registrationNumber = input.registrationNumber;
    if (input.taxId !== undefined) data.taxId = input.taxId;
    if (input.website !== undefined) data.website = input.website;
    if (input.contactEmail !== undefined) data.contactEmail = normalizeEmail(input.contactEmail);
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone;
    if (input.address !== undefined) data.address = input.address;
    if (input.businessDescription !== undefined) data.businessDescription = input.businessDescription;
    if (input.serviceCategories !== undefined) {
      data.serviceCategories = input.serviceCategories as unknown as Prisma.InputJsonValue;
    }
    return data;
  }

  /** Валидация перед submit (§13): обязательные поля + terms + бизнес-поля. */
  private async validateForSubmit(app: {
    applicantType: ApplicantType;
    brandName: string;
    country: string;
    contactEmail: string;
    termsAccepted: boolean;
    legalName: string | null;
    serviceCategories: Prisma.JsonValue | null;
  }): Promise<void> {
    if (app.brandName.trim().length < 2) {
      throw new ValidationDomainError("Brand/display name is required (min 2 chars)");
    }
    if (app.country.trim().length < 2) {
      throw new ValidationDomainError("Country is required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(app.contactEmail))) {
      throw new ValidationDomainError("Valid contact email is required");
    }
    if (app.termsAccepted !== true) {
      throw new ValidationDomainError("Terms and conditions must be accepted");
    }
    if (app.applicantType === "COMPANY" && !app.legalName?.trim()) {
      throw new ValidationDomainError("Legal/company name is required for COMPANY applicants");
    }
    // Service categories — только ACTIVE категории (onboarding metadata, §11).
    const slugs = Array.isArray(app.serviceCategories) ? (app.serviceCategories as unknown[]).filter((s): s is string => typeof s === "string") : [];
    if (slugs.length > 0) {
      const active = await this.prisma.category.findMany({
        where: { slug: { in: slugs }, status: "ACTIVE" },
        select: { slug: true },
      });
      const activeSet = new Set(active.map((c) => c.slug));
      const invalid = slugs.filter((s) => !activeSet.has(s));
      if (invalid.length > 0) {
        throw new ValidationDomainError(`Unknown/inactive service categories: ${invalid.join(", ")}`);
      }
    }
  }

}
