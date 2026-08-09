/**
 * PublicSellerProfileService (Phase 1 Step 1.11) — публичная идентичность продавца
 * на Marketplace. ОТДЕЛЬНАЯ projection от crm.Partner (CRM остаётся владельцем
 * Partner): marketplace НИКОГДА не публикует raw CRM данные.
 *
 * Invariants:
 *  - default для нового/существующего Partner — ANONYMOUS (консервативно);
 *  - PARTNER предлагает (displayName/description/location), НЕ self-approve,
 *    НЕ может сам переключить visibilityMode (requested — только VERIFIED_ALIAS;
 *    PUBLIC_BRAND выдаёт MODERATOR правом approve_brand);
 *  - изменения применяются ТОЛЬКО через APPROVED proposal (no silent overwrite);
 *  - MODERATOR решает (approve alias/brand, reject, request changes, hide);
 *  - MODERATOR не получает CRM edit rights (нет crm.* прав в матрице);
 *  - proposal/public profile никогда не публикуются до approve (hidden/unpublished
 *    профиль не светится в public контуре — публичный контур фильтрует по статусу).
 *
 * Всё, что здесь пишется — ТОЛЬКО catalog.* (собственная схема Catalog).
 */
import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { Prisma, type SellerProposalStatus, type SellerVisibilityMode } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import { RoleCode } from "../../../generated/prisma/enums";
import { AntiDisintermediationService } from "../anti-disintermediation/anti-disintermediation.service";
import { assertValidCityForCountry, isKnownCountryCode } from "./locations";

/** Причины решений MODERATOR по seller profile (стабильные коды). */
export const SELLER_PROPOSAL_REASON_CODES = [
  "INSUFFICIENT_INFO",
  "INAPPROPRIATE_NAME",
  "MISLEADING_CONTENT",
  "DISINTERMEDIATION_ATTEMPT",
  "OTHER",
] as const;
export type SellerProposalReasonCode = (typeof SELLER_PROPOSAL_REASON_CODES)[number];

export interface SellerProfileView {
  id: string;
  publicId: string;
  partnerId: string;
  status: string;
  visibilityMode: string;
  publicDisplayName: string | null;
  publicDescription: string | null;
  /** Authoritative geography (FIX 2) — коды, не locale-значения. */
  countryCode: string | null;
  cityCode: string | null;
  /** Системная country identity из crm.Partner (читается cross-schema). */
  systemCountryCode: string | null;
  verified: boolean;
  memberSince: string;
  approvedAt: string | null;
  approvedByUsername: string | null;
  version: number;
}

export interface SellerProposalView {
  id: string;
  code: string;
  profileId: string;
  /** Внутренний staff-контракт: partnerId нужен для hide/unhide (в public НЕ отдаётся). */
  partnerId: string;
  status: string;
  version: number;
  requestedDisplayName: string | null;
  requestedDescription: string | null;
  /** Город-код из справочника; страна в предложении ОТСУТСТВУЕТ (системная). */
  requestedCityCode: string | null;
  /** Системная country identity партнёра (для review UI, locale-независима). */
  profileCountryCode: string | null;
  requestedVisibilityMode: string;
  approvedVisibilityMode: string | null;
  submittedById: string | null;
  submittedByUsername: string | null;
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  decisionComment: string | null;
  createdAt: string;
}

export interface SellerProposalInput {
  publicDisplayName?: string;
  publicDescription?: string;
  /** Код города из канонического справочника (должен принадлежать стране партнёра). */
  cityCode?: string;
}

export interface SellerProposalListQuery {
  status?: string;
  page?: number;
  pageSize?: number;
}

const EDITABLE_PROPOSAL_STATUSES: SellerProposalStatus[] = ["DRAFT", "CHANGES_REQUESTED"];

@Injectable()
export class PublicSellerProfileService {
  private readonly logger = new Logger(PublicSellerProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly antiDisintermediation: AntiDisintermediationService,
  ) {}

  // ── Creation (event consumer / deterministic backfill) ────────────────────

  /**
   * Создание консервативного ANONYMOUS профиля (если ещё нет) для Partner.
   * Используется consumer-ом PartnerCreated и детерминированным backfill для
   * существующих ACTIVE Partners. Идемпотентно (unique partnerId). Никогда не
   * копирует raw CRM поля (legalName/taxId/phone/email/website).
   */
  async ensureProfileForPartner(tx: Prisma.TransactionClient, partnerId: string, countryCode?: string | null): Promise<string> {
    const existing = await tx.publicSellerProfile.findUnique({
      where: { partnerId },
      select: { id: true },
    });
    if (existing) return existing.id;
    const publicId = await this.ids.nextCode(tx, "SELL");
    const created = await tx.publicSellerProfile.create({
      data: {
        publicId,
        partnerId,
        status: "APPROVED",
        visibilityMode: "ANONYMOUS",
        countryCode: isKnownCountryCode(countryCode) ? countryCode : null,
        verified: true,
      },
      select: { id: true },
    });
    this.logger.log(`Created conservative ANONYMOUS PublicSellerProfile ${publicId} for partner ${partnerId}`);
    return created.id;
  }

  // ── PARTNER: own profile / proposals ──────────────────────────────────────

  /** Свой профиль + последнее предложение (PARTNER own-scope). */
  async getOwnProfile(actor: AuthUser): Promise<{ profile: SellerProfileView | null; latestProposal: SellerProposalView | null }> {
    if (!actor.partnerId) throw new ForbiddenException("Seller profile requires an approved partner account");
    const profile = await this.prisma.publicSellerProfile.findUnique({
      where: { partnerId: actor.partnerId },
    });
    if (!profile) return { profile: null, latestProposal: null };
    const latest = await this.prisma.publicSellerProfileProposal.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: { profile: { select: { partnerId: true } } },
    });
    const systemCountryCode = await this.systemCountryCode(actor.partnerId);
    return { profile: this.toProfileView(profile, systemCountryCode), latestProposal: latest ? this.toProposalView(latest, systemCountryCode) : null };
  }

  /** PARTNER: создать черновик предложения (DRAFT). Не self-approve, не self-switch. */
  async createProposal(actor: AuthUser, input: SellerProposalInput): Promise<SellerProposalView> {
    if (!actor.partnerId) throw new ForbiddenException("Seller profile requires an approved partner account");
    const profile = await this.prisma.publicSellerProfile.findUnique({ where: { partnerId: actor.partnerId } });
    if (!profile) throw new NotFoundError("Seller profile not found");

    const code = await this.prisma.$transaction(async (tx) => {
      return this.ids.nextCode(tx, "SPP");
    });
    const row = await this.prisma.publicSellerProfileProposal.create({
      data: {
        code,
        profileId: profile.id,
        status: "DRAFT",
        requestedDisplayName: input.publicDisplayName?.trim() || null,
        requestedDescription: input.publicDescription?.trim() || null,
        requestedCityCode: input.cityCode?.trim() || null,
        requestedVisibilityMode: "VERIFIED_ALIAS",
      },
    });      await this.security.audit(this.prisma as unknown as Prisma.TransactionClient, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.proposal_created",
        resource: "PublicSellerProfileProposal",
        resourceId: row.id,
        details: { profileId: profile.id },
      });
    return this.toProposalView(row, await this.systemCountryCode(profile.partnerId));
  }

  /** PARTNER: редактировать СВОЁ предложение (только DRAFT/CHANGES_REQUESTED, CAS). */
  async updateProposal(actor: AuthUser, proposalId: string, input: SellerProposalInput): Promise<SellerProposalView> {
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id: proposalId },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${proposalId} not found`);
    await this.assertOwnProposal(actor, row);
    if (!EDITABLE_PROPOSAL_STATUSES.includes(row.status as SellerProposalStatus)) {
      throw new ConflictError(`Cannot edit proposal: status is ${row.status}`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfileProposal.updateMany({
        where: { id: proposalId, version: row.version, status: { in: EDITABLE_PROPOSAL_STATUSES } },
        data: {
          requestedDisplayName: input.publicDisplayName !== undefined ? input.publicDisplayName.trim() || null : row.requestedDisplayName,
          requestedDescription: input.publicDescription !== undefined ? input.publicDescription.trim() || null : row.requestedDescription,
          requestedCityCode: input.cityCode !== undefined ? input.cityCode.trim() || null : row.requestedCityCode,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new ConflictError("Proposal was modified concurrently; reload and retry");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.proposal_updated",
        resource: "PublicSellerProfileProposal",
        resourceId: proposalId,
        details: { profileId: row.profileId },
      });
      return tx.publicSellerProfileProposal.findUniqueOrThrow({ where: { id: proposalId }, include: { profile: { select: { partnerId: true } } } });
    });
    return this.toProposalView(updated, await this.systemCountryCode(row.profile.partnerId));
  }

  /** PARTNER: отправить предложение на review (DRAFT/CHANGES_REQUESTED → SUBMITTED). */
  async submitProposal(actor: AuthUser, proposalId: string): Promise<SellerProposalView> {
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id: proposalId },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${proposalId} not found`);
    await this.assertOwnProposal(actor, row);
    if (!EDITABLE_PROPOSAL_STATUSES.includes(row.status as SellerProposalStatus)) {
      throw new ConflictError(`Cannot submit proposal: status is ${row.status}`);
    }
    // Step 1.11 §11: seller description/name — free-text витрины, сканируется
    // детектором anti-disintermediation (та же политика, что и Product content).
    this.antiDisintermediation.assertNoViolations([
      { value: row.requestedDisplayName, field: "publicDisplayName" },
      { value: row.requestedDescription, field: "publicDescription" },
    ]);
    // Step 1.11 FIX 2: город — только код из справочника, принадлежащий стране
    // партнёра (системная identity). Страну proposal не содержит вовсе.
    const systemCountry = await this.systemCountryCode(row.profile.partnerId);
    if (row.requestedCityCode) {
      if (!systemCountry) {
        throw new ValidationDomainError("Cannot submit city: partner has no authoritative country identity");
      }
      assertValidCityForCountry(row.requestedCityCode, systemCountry);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfileProposal.updateMany({
        where: { id: proposalId, version: row.version, status: { in: EDITABLE_PROPOSAL_STATUSES } },
        data: {
          status: "SUBMITTED",
          submittedById: actor.id,
          submittedByUsername: actor.username,
          submittedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new ConflictError("Proposal was modified concurrently; reload and retry");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.proposal_submitted",
        resource: "PublicSellerProfileProposal",
        resourceId: proposalId,
        details: { profileId: row.profileId },
      });
      return tx.publicSellerProfileProposal.findUniqueOrThrow({ where: { id: proposalId }, include: { profile: { select: { partnerId: true } } } });
    });
    return this.toProposalView(updated, systemCountry);
  }

  /** PARTNER: свои предложения (own-scope). */
  async ownProposals(actor: AuthUser): Promise<SellerProposalView[]> {
    if (!actor.partnerId) throw new ForbiddenException("Seller profile requires an approved partner account");
    const rows = await this.prisma.publicSellerProfileProposal.findMany({
      where: { profile: { partnerId: actor.partnerId } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toProposalView(r));
  }

  // ── MODERATOR: review queue ───────────────────────────────────────────────

  async listProposals(query: SellerProposalListQuery): Promise<{ items: SellerProposalView[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.PublicSellerProfileProposalWhereInput = query.status ? { status: query.status as SellerProposalStatus } : {};
    const [rows, total] = await Promise.all([
      this.prisma.publicSellerProfileProposal.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { profile: { select: { partnerId: true } } },
      }),
      this.prisma.publicSellerProfileProposal.count({ where }),
    ]);
    const countries = await this.countryCodesFor(rows.map((r) => r.profile.partnerId));
    return { items: rows.map((r) => this.toProposalView(r, countries.get(r.profile.partnerId) ?? null)), total, page, pageSize };
  }

  async getProposal(id: string): Promise<SellerProposalView> {
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${id} not found`);
    const systemCountry = await this.systemCountryCode(row.profile.partnerId);
    return this.toProposalView(row, systemCountry);
  }

  /** MODERATOR: start review (SUBMITTED → IN_REVIEW, CAS; idempotent для того же ревьюера). */
  async startReview(id: string, actor: AuthUser): Promise<SellerProposalView> {
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${id} not found`);
    if (row.status === "IN_REVIEW") {
      if (row.reviewedById === actor.id) return this.toProposalView(row);
      throw new ConflictError("Review already started by another moderator");
    }
    if (row.status !== "SUBMITTED") throw new ConflictError(`Cannot start review: proposal is ${row.status}`);
    this.assertNoSelfReview(actor, row);
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfileProposal.updateMany({
        where: { id, status: "SUBMITTED" },
        data: { status: "IN_REVIEW", reviewedById: actor.id, reviewedByUsername: actor.username, reviewedAt: new Date() },
      });
      if (res.count === 0) throw new ConflictError("Proposal was modified concurrently; reload and retry");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.review_started",
        resource: "PublicSellerProfileProposal",
        resourceId: id,
        details: { profileId: row.profileId },
      });
      return tx.publicSellerProfileProposal.findUniqueOrThrow({ where: { id }, include: { profile: { select: { partnerId: true } } } });
    });
    return this.toProposalView(updated);
  }

  /**
   * MODERATOR: approve — применяет предложение к профилю (no silent overwrite:
   * публикация ТОЛЬКО здесь) и фиксирует утверждённый visibilityMode.
   *  - approvedVisibilityMode VERIFIED_ALIAS → показывается alias (approve_alias);
   *  - approvedVisibilityMode PUBLIC_BRAND → показывается реальный бренд (approve_brand);
   *  - не указан → VERIFIED_ALIAS (консервативно).
   * PARTNER не может self-approve (проверка в assertNoSelfReview).
   */
  async approve(id: string, actor: AuthUser, approvedVisibilityMode?: string): Promise<SellerProposalView> {
    const mode = approvedVisibilityMode && approvedVisibilityMode !== "VERIFIED_ALIAS" ? approvedVisibilityMode : "VERIFIED_ALIAS";
    if (mode !== "VERIFIED_ALIAS" && mode !== "PUBLIC_BRAND") {
      throw new ValidationDomainError(`Invalid approvedVisibilityMode "${approvedVisibilityMode}"; allowed: VERIFIED_ALIAS, PUBLIC_BRAND`);
    }
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${id} not found`);
    if (row.status === "APPROVED") return this.toProposalView(row); // idempotent retry
    if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") {
      throw new ConflictError(`Cannot approve: proposal is ${row.status}`);
    }
    this.assertNoSelfReview(actor, row);
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfileProposal.updateMany({
        where: { id, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
        data: {
          status: "APPROVED",
          approvedVisibilityMode: mode as SellerVisibilityMode,
          reviewedById: actor.id,
          reviewedByUsername: actor.username,
          reviewedAt: new Date(),
          decisionReason: "approved",
          version: { increment: 1 },
        },
      });      if (res.count === 0) throw new ConflictError("Proposal was modified concurrently; reload and retry");

      // Step 1.11 FIX 2: география при approve — ТОЛЬКО из системной identity.
      // Страна копируется из crm.Partner (proposal её не несёт и подменить не
      // может); город — код из справочника, валидируется по стране партнёра.
      const systemCountry = await this.systemCountryCode(row.profile.partnerId);
      let cityCode: string | null = null;
      if (row.requestedCityCode) {
        if (!systemCountry) {
          throw new ValidationDomainError("Cannot approve city: partner has no authoritative country identity");
        }
        assertValidCityForCountry(row.requestedCityCode, systemCountry);
        cityCode = row.requestedCityCode;
      }
      // Применение к профилю в той же транзакции (публикация N+1, только здесь).
      await tx.publicSellerProfile.update({
        where: { id: row.profileId },
        data: {
          status: "APPROVED",
          visibilityMode: mode as SellerVisibilityMode,
          publicDisplayName: row.requestedDisplayName,
          publicDescription: row.requestedDescription,
          countryCode: isKnownCountryCode(systemCountry) ? systemCountry : null,
          cityCode,
          approvedAt: new Date(),
          approvedById: actor.id,
          approvedByUsername: actor.username,
          version: { increment: 1 },
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.approved",
        resource: "PublicSellerProfileProposal",
        resourceId: id,
        details: { profileId: row.profileId, visibilityMode: mode },
      });
      return tx.publicSellerProfileProposal.findUniqueOrThrow({ where: { id }, include: { profile: { select: { partnerId: true } } } });
    });
    return this.toProposalView(updated);
  }

  /** MODERATOR: reject (IN_REVIEW/SUBMITTED → REJECTED). */
  async reject(id: string, actor: AuthUser, reasonCode: string, comment?: string): Promise<SellerProposalView> {
    this.assertReason(reasonCode, comment);
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${id} not found`);
    if (row.status === "REJECTED") return this.toProposalView(row);
    if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") {
      throw new ConflictError(`Cannot reject: proposal is ${row.status}`);
    }
    this.assertNoSelfReview(actor, row);
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfileProposal.updateMany({
        where: { id, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
        data: {
          status: "REJECTED",
          reviewedById: actor.id,
          reviewedByUsername: actor.username,
          reviewedAt: new Date(),
          decisionReason: reasonCode,
          decisionComment: comment?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new ConflictError("Proposal was modified concurrently; reload and retry");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.rejected",
        resource: "PublicSellerProfileProposal",
        resourceId: id,
        details: { profileId: row.profileId, reasonCode, comment: comment ?? null },
      });
      return tx.publicSellerProfileProposal.findUniqueOrThrow({ where: { id }, include: { profile: { select: { partnerId: true } } } });
    });
    return this.toProposalView(updated);
  }

  /** MODERATOR: request changes (→ CHANGES_REQUESTED; PARTNER снова может править). */
  async requestChanges(id: string, actor: AuthUser, reasonCode: string, comment?: string): Promise<SellerProposalView> {
    this.assertReason(reasonCode, comment);
    const row = await this.prisma.publicSellerProfileProposal.findUnique({
      where: { id },
      include: { profile: { select: { partnerId: true } } },
    });
    if (!row) throw new NotFoundError(`Seller proposal ${id} not found`);
    if (row.status === "CHANGES_REQUESTED") return this.toProposalView(row);
    if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") {
      throw new ConflictError(`Cannot request changes: proposal is ${row.status}`);
    }
    this.assertNoSelfReview(actor, row);
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfileProposal.updateMany({
        where: { id, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
        data: {
          status: "CHANGES_REQUESTED",
          reviewedById: actor.id,
          reviewedByUsername: actor.username,
          reviewedAt: new Date(),
          decisionReason: reasonCode,
          decisionComment: comment?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new ConflictError("Proposal was modified concurrently; reload and retry");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.changes_requested",
        resource: "PublicSellerProfileProposal",
        resourceId: id,
        details: { profileId: row.profileId, reasonCode, comment: comment ?? null },
      });
      return tx.publicSellerProfileProposal.findUniqueOrThrow({ where: { id }, include: { profile: { select: { partnerId: true } } } });
    });
    return this.toProposalView(updated);
  }

  /** MODERATOR: скрыть публичную идентичность продавца (HIDDEN → не показывается). */
  async hide(partnerId: string, actor: AuthUser): Promise<SellerProfileView> {
    const profile = await this.prisma.publicSellerProfile.findUnique({ where: { partnerId } });
    if (!profile) throw new NotFoundError("Seller profile not found");
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfile.updateMany({
        where: { id: profile.id, status: "APPROVED" },
        data: { status: "HIDDEN", version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError("Seller profile is already hidden or was modified concurrently");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.hidden",
        resource: "PublicSellerProfile",
        resourceId: profile.id,
        details: { partnerId },
      });
      return tx.publicSellerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    });
    return this.toProfileView(updated);
  }

  /** MODERATOR: восстановить идентичность (HIDDEN → APPROVED; visibilityMode сохраняется). */
  async unhide(partnerId: string, actor: AuthUser): Promise<SellerProfileView> {
    const profile = await this.prisma.publicSellerProfile.findUnique({ where: { partnerId } });
    if (!profile) throw new NotFoundError("Seller profile not found");
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.publicSellerProfile.updateMany({
        where: { id: profile.id, status: "HIDDEN" },
        data: { status: "APPROVED", version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError("Seller profile is not hidden or was modified concurrently");
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "seller_profile.unhidden",
        resource: "PublicSellerProfile",
        resourceId: profile.id,
        details: { partnerId },
      });
      return tx.publicSellerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    });
    return this.toProfileView(updated);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Системная country identity партнёра из crm.Partner (cross-schema read). */
  private async systemCountryCode(partnerId: string): Promise<string | null> {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { countryCode: true } });
    return partner?.countryCode ?? null;
  }

  private async countryCodesFor(partnerIds: string[]): Promise<Map<string, string | null>> {
    const uniq = [...new Set(partnerIds.filter(Boolean))];
    if (uniq.length === 0) return new Map();
    const partners = await this.prisma.partner.findMany({ where: { id: { in: uniq } }, select: { id: true, countryCode: true } });
    return new Map(partners.map((p) => [p.id, p.countryCode]));
  }

  private async assertOwnProposal(actor: AuthUser, row: { profileId: string }): Promise<void> {
    if (!actor.partnerId) throw new ForbiddenException("PARTNER account required");
    const profile = await this.prisma.publicSellerProfile.findUnique({ where: { id: row.profileId }, select: { partnerId: true } });
    if (!profile || profile.partnerId !== actor.partnerId) {
      throw new ForbiddenException("Cannot modify another partner's seller profile");
    }
  }

  /** Self-review/self-approve protection: MODERATOR/PARTNER не решает свою заявку. */
  private assertNoSelfReview(actor: AuthUser, row: { profileId: string }): void {
    if (actor.role === RoleCode.PARTNER) {
      throw new ForbiddenException("PARTNER cannot review seller profile proposals");
    }
    void row;
  }

  private assertReason(reasonCode: string, comment?: string): void {
    if (!(SELLER_PROPOSAL_REASON_CODES as readonly string[]).includes(reasonCode)) {
      throw new ValidationDomainError(`Invalid reasonCode; allowed: ${SELLER_PROPOSAL_REASON_CODES.join(", ")}`);
    }
    if (reasonCode === "OTHER" && !comment?.trim()) {
      throw new ValidationDomainError("reasonCode OTHER requires a comment");
    }
  }

  private toProfileView(
    p: {
      id: string;
      publicId: string;
      partnerId: string;
      status: string;
      visibilityMode: string;
      publicDisplayName: string | null;
      publicDescription: string | null;
      countryCode: string | null;
      cityCode: string | null;
      verified: boolean;
      memberSince: Date;
      approvedAt: Date | null;
      approvedByUsername: string | null;
      version: number;
    },
    systemCountryCode?: string | null,
  ): SellerProfileView {
    return {
      id: p.id,
      publicId: p.publicId,
      partnerId: p.partnerId,
      status: p.status,
      visibilityMode: p.visibilityMode,
      publicDisplayName: p.publicDisplayName,
      publicDescription: p.publicDescription,
      countryCode: p.countryCode,
      cityCode: p.cityCode,
      systemCountryCode: systemCountryCode ?? null,
      verified: p.verified,
      memberSince: p.memberSince.toISOString(),
      approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
      approvedByUsername: p.approvedByUsername,
      version: p.version,
    };
  }

  private toProposalView(
    r: {
      id: string;
      code: string;
      profileId: string;
      profile?: { partnerId: string } | null;
      status: string;
      version: number;
      requestedDisplayName: string | null;
      requestedDescription: string | null;
      requestedCityCode: string | null;
      requestedVisibilityMode: string;
      approvedVisibilityMode: string | null;
      submittedById: string | null;
      submittedByUsername: string | null;
      submittedAt: Date | null;
      reviewedById: string | null;
      reviewedByUsername: string | null;
      reviewedAt: Date | null;
      decisionReason: string | null;
      decisionComment: string | null;
      createdAt: Date;
    },
    systemCountryCode?: string | null,
  ): SellerProposalView {
    return {
      id: r.id,
      code: r.code,
      profileId: r.profileId,
      partnerId: r.profile?.partnerId ?? "",
      status: r.status,
      version: r.version,
      requestedDisplayName: r.requestedDisplayName,
      requestedDescription: r.requestedDescription,
      requestedCityCode: r.requestedCityCode,
      profileCountryCode: systemCountryCode ?? null,
      requestedVisibilityMode: r.requestedVisibilityMode,
      approvedVisibilityMode: r.approvedVisibilityMode,
      submittedById: r.submittedById,
      submittedByUsername: r.submittedByUsername,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      reviewedById: r.reviewedById,
      reviewedByUsername: r.reviewedByUsername,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      decisionReason: r.decisionReason,
      decisionComment: r.decisionComment,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
