/**
 * StorefrontService (Phase 1 Step 1.12.1 + 1.12.2) — Partner Storefront domain.
 *
 * Catalog-owned (catalog.PartnerStorefront): НЕ является вторым Catalog / копией
 * Product/CRM — витрина только ссылается на существующие catalog.Product этого
 * Partner (один Product используется и Marketplace, и Storefront). CRM Partner
 * остаётся CRM-owned; здесь хранится только partnerId (без FK, ADR-0001).
 *
 * Step 1.12.2 — Storefront business identity:
 *  - PublicSellerProfile (Step 1.11) остаётся Marketplace identity; Storefront
 *    имеет СОБСТВЕННУЮ business identity (businessName + structured contacts +
 *    branding), потому что это платный SaaS-сайт PARTNER. Marketplace НЕ получает
 *    storefront businessName/контакты (публичный Marketplace-контур показывает
 *    только seller projection из PublicSellerProfile);
 *  - contacts публикуются ТОЛЬКО в Storefront-контексте (ACTIVE + entitlement
 *    ACTIVE); DRAFT/INACTIVE/SUSPENDED/EXPIRED → нейтральный 404;
 *  - countryCode — системная identity из crm.Partner (записывается сервисом,
 *    НЕ из body); cityCode — код канонического справочника Catalog, обязан
 *    принадлежать стране витрины;
 *  - anti-disintermediation (Step 1.11) применяется к businessName/tagline/
 *    description на create/update/activate; произвольный HTML запрещён;
 *  - branding: heroHeading/heroSubheading + themePreset из безопасного whitelist
 *    (без arbitrary CSS/JS/HTML); logo/hero — StorefrontMedia (private storage,
 *    controlled upload, стабильный public URL только при ACTIVE+entitled);
 *  - preview: own-scope, не делает витрину публичной (anonymous /store/:slug
 *    остаётся 404 для DRAFT/INACTIVE), staged media owner-only.
 *
 * Прочие инварианты (Step 1.12.1): explicit provisioning; lifecycle
 * DRAFT → ACTIVE → INACTIVE с детерминированными no-op; ownership ТОЛЬКО из
 * actor.partnerId; entitlement gate при публичной активации; slug normalized/
 * immutable; audit; temporal-модель (activatedAt/deactivatedAt + actor); DB
 * unique-инварианты (partnerId/slug); события НЕ создаются (нет consumer'а).
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma, type StorefrontEntitlementStatus, type StorefrontMediaKind } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import { uniqueConstraintNames } from "../../../shared/prisma-errors";
import { RoleCode } from "../../../generated/prisma/enums";
import type { AuthUser } from "../../../security/auth/auth.service";
import { AntiDisintermediationService } from "../anti-disintermediation/anti-disintermediation.service";
import { validateStorefrontSlug } from "./storefront-slug";
import { assertValidCityForCountry, isKnownCountryCode } from "../seller/locations";
import { MediaProcessor } from "../media/media-processor.service";
import type { ObjectStorageService } from "../media/storage/storage.interface";

/** Допустимые locale контента витрины (НЕ country codes — только display locale). */
export const STOREFRONT_LOCALES = ["ru", "az", "en"] as const;

/** Безопасный whitelist theme presets (без arbitrary CSS/JS/HTML). */
export const STOREFRONT_THEMES = ["default", "forest", "ocean", "sunset", "mono"] as const;

/** Платформы соцсетей (structured social links). */
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "telegram", "tiktok", "youtube", "linkedin", "x", "vk"] as const;

export interface SocialLinkInput {
  platform: string;
  url: string;
}

export interface StorefrontCreateInput {
  slug: string;
  businessName?: string;
  tagline?: string;
  description?: string;
  defaultLocale?: string;
}

export interface StorefrontUpdateInput {
  businessName?: string;
  tagline?: string;
  description?: string;
  defaultLocale?: string;
  cityCode?: string;
  publicPhone?: string;
  publicEmail?: string;
  websiteUrl?: string;
  whatsapp?: string;
  socialLinks?: SocialLinkInput[];
  heroHeading?: string;
  heroSubheading?: string;
  themePreset?: string;
}

export interface StorefrontView {
  id: string;
  code: string;
  partnerId: string;
  slug: string;
  status: string;
  /** Коммерческий entitlement (REVIEW FIX 2). Внутреннее поле — в public НЕ отдаётся. */
  entitlementStatus: string;
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  defaultLocale: string;
  /** География (коды; локализацию выполняет клиент). */
  countryCode: string | null;
  cityCode: string | null;
  /** Structured contacts — только Storefront-контекст. */
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  whatsapp: string | null;
  socialLinks: SocialLinkInput[] | null;
  /** Branding. */
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  /** Storefront-owned media (metadata; байты — через media endpoints). */
  media: Array<{ id: string; kind: string; mimeType: string; width: number | null; height: number | null; createdAt: string }>;
  /** Публичный URL витрины (работает только при ACTIVE + entitlement ACTIVE). */
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,24}$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly antiDisintermediation: AntiDisintermediationService,
    private readonly processor: MediaProcessor,
    @Inject("ObjectStorageService") private readonly storage: ObjectStorageService,
  ) {}

  // ── Eligibility (Step 1.12.1 §9) ─────────────────────────────────────────

  /**
   * Gate: PARTNER управляет storefront только если authenticated (guard), role=PARTNER,
   * User ACTIVE (guard rejects non-ACTIVE), User.partnerId != null (approved onboarding),
   * CRM Partner reference валиден (существует + ACTIVE; cross-schema read ADR-0001).
   * Pending PARTNER (partnerId=null) → 403; BUYER/MODERATOR/ADMIN → 403
   * (это PARTNER-own контракт; ADMIN не получает partner-own write через него).
   * Возвращает канонический partnerId (единственный security source).
   */
  private async assertEligible(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.PARTNER) {
      throw new ForbiddenError("Only PARTNER can manage a storefront (partner-own contract)");
    }
    if (!actor.partnerId) {
      throw new ForbiddenError(
        "Partner onboarding is not approved: storefront is not allowed until User.partnerId is assigned",
      );
    }
    const partner = await this.prisma.partner.findUnique({
      where: { id: actor.partnerId },
      select: { status: true, countryCode: true },
    });
    if (!partner) {
      throw new ForbiddenError("CRM partner reference is not valid; storefront access denied");
    }
    if (partner.status !== "ACTIVE") {
      throw new ForbiddenError("CRM partner is not ACTIVE; storefront access denied");
    }
    return actor.partnerId;
  }

  /** Системная country identity партнёра (locale-независима, для географии витрины). */
  private async systemCountryOf(partnerId: string): Promise<string | null> {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { countryCode: true } });
    return partner?.countryCode ?? null;
  }

  // ── PARTNER: own storefront ──────────────────────────────────────────────

  /** GET own storefront (own-scope). Нет витрины → neutral 404. */
  async getOwn(actor: AuthUser): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");
    return this.toView(sf);
  }

  /**
   * Explicit provisioning: create → DRAFT (не публикует автоматически).
   * Только approved/linked PARTNER. Один storefront на Partner (DB unique).
   */
  async createOwn(actor: AuthUser, input: StorefrontCreateInput): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const slugResult = validateStorefrontSlug(input.slug ?? "");
    if (!slugResult.ok || !slugResult.slug) {
      throw new ValidationDomainError(slugResult.error ?? "Invalid slug");
    }
    this.assertContentPolicy(input, "create");
    const defaultLocale = this.assertLocale(input.defaultLocale);

    const row = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "SF");
      // Step 3.12 — deterministic storefrontCode via Hi/Lo block allocation
      const storefrontCode = await this.ids.nextStorefrontCode(tx);
      let created: Prisma.PartnerStorefrontGetPayload<Record<string, never>>;
      try {
        created = await tx.partnerStorefront.create({
          data: {
            code,
            storefrontCode,
            partnerId,
            slug: slugResult.slug!,
            status: "DRAFT",
            businessName: input.businessName?.trim() || null,
            tagline: input.tagline?.trim() || null,
            description: input.description?.trim() || null,
            defaultLocale,
            // География: countryCode — системная identity из crm.Partner (не из body).
            countryCode: await this.systemCountryOf(partnerId),
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
      } catch (err) {
        // REVIEW FIX 10: единый P2002-normalization (любой Prisma shape → controlled 409).
        const names = uniqueConstraintNames(err);
        if (names.some((n) => n.toLowerCase().includes("partnerid"))) {
          throw new ConflictError("A storefront already exists for this partner (one storefront per partner)");
        }
        if (names.some((n) => n.toLowerCase().includes("slug"))) {
          throw new ConflictError(`Storefront slug "${slugResult.slug}" is already taken`);
        }
        throw err;
      }
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "storefront.created",
        resource: "PartnerStorefront",
        resourceId: created.id,
        details: { partnerId, slug: created.slug, status: created.status, businessName: created.businessName ?? null },
      });
      return created;
    });

    this.logger.log(`Storefront ${row.code} (${row.slug}) created for partner ${partnerId} (DRAFT)`);
    return this.toView({ ...row, media: [] });
  }

  /**
   * PATCH own storefront. slug immutable; countryCode системный (не из body).
   * Contacts/branding/geography валидируются на каждой записи; активация всегда
   * перевалидирует повторно. Допустимо в любом статусе.
   */
  async updateOwn(actor: AuthUser, input: StorefrontUpdateInput): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");

    const businessName = input.businessName !== undefined ? input.businessName.trim() || null : sf.businessName;
    const tagline = input.tagline !== undefined ? input.tagline.trim() || null : sf.tagline;
    const description = input.description !== undefined ? input.description.trim() || null : sf.description;
    const defaultLocale = input.defaultLocale !== undefined ? this.assertLocale(input.defaultLocale) : sf.defaultLocale;
    const cityCode = input.cityCode !== undefined ? (input.cityCode.trim() || null) : sf.cityCode;
    const publicPhone = input.publicPhone !== undefined ? (input.publicPhone.trim() || null) : sf.publicPhone;
    const publicEmail = input.publicEmail !== undefined ? (input.publicEmail.trim().toLowerCase() || null) : sf.publicEmail;
    const websiteUrl = input.websiteUrl !== undefined ? (input.websiteUrl.trim() || null) : sf.websiteUrl;
    const whatsapp = input.whatsapp !== undefined ? (input.whatsapp.trim() || null) : sf.whatsapp;
    const socialLinks = input.socialLinks !== undefined ? input.socialLinks : ((sf.socialLinks ?? null) as SocialLinkInput[] | null);
    const heroHeading = input.heroHeading !== undefined ? (input.heroHeading.trim() || null) : sf.heroHeading;
    const heroSubheading = input.heroSubheading !== undefined ? (input.heroSubheading.trim() || null) : sf.heroSubheading;
    const themePreset = input.themePreset !== undefined ? this.assertTheme(input.themePreset) : sf.themePreset;

    this.assertContentPolicy({ businessName, tagline, description }, "update");
    this.assertContacts({ publicPhone, publicEmail, websiteUrl, whatsapp, socialLinks });
    // География: cityCode обязан принадлежать системной стране витрины.
    const countryCode = sf.countryCode ?? (await this.systemCountryOf(partnerId));
    if (cityCode) {
      if (!countryCode || !isKnownCountryCode(countryCode)) {
        throw new ValidationDomainError(
          "The partner has no authoritative country; set the country in the onboarding application first",
        );
      }
      assertValidCityForCountry(cityCode, countryCode);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.partnerStorefront.update({
        where: { id: sf.id },
        data: {
          businessName,
          tagline,
          description,
          defaultLocale,
          countryCode,
          cityCode,
          publicPhone,
          publicEmail,
          websiteUrl,
          whatsapp,
          socialLinks: socialLinks ? (socialLinks as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          heroHeading,
          heroSubheading,
          themePreset,
          updatedById: actor.id,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "storefront.updated",
        resource: "PartnerStorefront",
        resourceId: sf.id,
        details: {
          partnerId,
          status: updated.status,
          changed: {
            businessName,
            tagline,
            description,
            defaultLocale,
            cityCode,
            publicPhone,
            publicEmail,
            websiteUrl,
            whatsapp,
            socialLinks,
            heroHeading,
            heroSubheading,
            themePreset,
          } as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
    return this.toView({ ...row, media: sf.media });
  }

  /**
   * Activate: DRAFT/INACTIVE → ACTIVE (CAS). Повторный activate при ACTIVE —
   * детерминированный no-op. До активации повторно валидируются:
   * anti-disintermediation и коммерческий entitlement (публичная activation
   * требует entitlementStatus = ACTIVE). User/Partner/Product status НЕ заменяют
   * entitlement.
   */
  async activateOwn(actor: AuthUser): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");
    if (sf.status === "ACTIVE") return this.toView(sf); // deterministic no-op

    // REVIEW FIX 2: entitlement boundary обязателен для PUBLIC activation.
    if (sf.entitlementStatus !== "ACTIVE") {
      throw new ForbiddenError(
        `Storefront entitlement is not active (current: ${sf.entitlementStatus}); public activation requires an active Storefront entitlement`,
      );
    }

    // Re-validation перед публичной активацией (policy актуальна).
    this.assertContentPolicy(sf, "activate");

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.partnerStorefront.updateMany({
        where: { id: sf.id, status: { in: ["DRAFT", "INACTIVE"] } },
        data: { status: "ACTIVE", activatedAt: new Date(), activatedById: actor.id, deactivatedAt: null, updatedById: actor.id },
      });
      if (res.count === 0) {
        const now = await tx.partnerStorefront.findUnique({ where: { id: sf.id } });
        if (now?.status === "ACTIVE") return now; // concurrent activate — тот же результат
        throw new ConflictError("Storefront was modified concurrently; reload and retry");
      }
      const updated = await tx.partnerStorefront.findUniqueOrThrow({ where: { id: sf.id } });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "storefront.activated",
        resource: "PartnerStorefront",
        resourceId: sf.id,
        details: { partnerId, from: sf.status, to: "ACTIVE", activatedAt: updated.activatedAt?.toISOString() ?? null },
      });
      return updated;
    });
    this.logger.log(`Storefront ${row.code} activated for partner ${partnerId}`);
    return this.toView({ ...row, media: sf.media });
  }

  /**
   * Deactivate: ACTIVE → INACTIVE (CAS). DRAFT/INACTIVE — детерминированный no-op.
   * Запись НЕ удаляется. SUSPENDED/EXPIRED entitlement скрывают витрину в public
   * контуре (public predicate) без удаления данных.
   */
  async deactivateOwn(actor: AuthUser): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");
    if (sf.status !== "ACTIVE") return this.toView(sf); // DRAFT/INACTIVE — no-op

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.partnerStorefront.updateMany({
        where: { id: sf.id, status: "ACTIVE" },
        data: { status: "INACTIVE", deactivatedAt: new Date(), deactivatedById: actor.id, updatedById: actor.id },
      });
      if (res.count === 0) {
        const now = await tx.partnerStorefront.findUnique({ where: { id: sf.id } });
        if (now?.status !== "ACTIVE") return now!; // concurrent deactivate — тот же результат
        throw new ConflictError("Storefront was modified concurrently; reload and retry");
      }
      const updated = await tx.partnerStorefront.findUniqueOrThrow({ where: { id: sf.id } });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "storefront.deactivated",
        resource: "PartnerStorefront",
        resourceId: sf.id,
        details: { partnerId, from: "ACTIVE", to: "INACTIVE", deactivatedAt: updated.deactivatedAt?.toISOString() ?? null },
      });
      return updated;
    });
    this.logger.log(`Storefront ${row.code} deactivated for partner ${partnerId}`);
    return this.toView({ ...row, media: sf.media });
  }

  // ── Entitlement (REVIEW FIX 2) ──────────────────────────────────────────

  /**
   * Операционная команда управления entitlement (ADMIN, storefront.entitlement.manage).
   * Граница будущего Billing/Subscription domain: НЕ фиктивный платёж — явный
   * статус, который позже станет authoritative от Billing domain (события).
   * SUSPENDED/EXPIRED скрывают публичную витрину (public predicate) БЕЗ удаления
   * Partner/Product/history. Идемпотентно: повторная установка того же статуса —
   * no-op без дублирования аудита.
   */
  async setEntitlement(partnerId: string, status: StorefrontEntitlementStatus, actor: AuthUser): Promise<StorefrontView> {
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");
    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.partnerStorefront.updateMany({
        where: { id: sf.id, entitlementStatus: { not: status } },
        data: { entitlementStatus: status, updatedById: actor.id },
      });
      const updated = await tx.partnerStorefront.findUniqueOrThrow({ where: { id: sf.id } });
      if (res.count > 0) {
        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "storefront.entitlement_changed",
          resource: "PartnerStorefront",
          resourceId: sf.id,
          details: { partnerId, from: sf.entitlementStatus, to: status },
        });
        this.logger.log(`Storefront ${sf.code} entitlement: ${sf.entitlementStatus} -> ${status} (partner ${partnerId})`);
      }
      return updated;
    });
    return this.toView({ ...row, media: sf.media });
  }

  // ── Storefront media (Step 1.12.2 §5/§6) ─────────────────────────────────

  /**
   * Upload/замена logo|hero. Own-scope. MIME/size валидация через MediaProcessor
   * (JPEG/PNG/WebP, максимум 15 MB на уровне multer, dimensions ≤ 12000²).
   * Файл приватный: публичные байты только при ACTIVE + entitlement ACTIVE
   * (public predicate); preview (owner) видит staged/любые. Replace-семантика:
   * один файл на kind (DB unique [storefrontId, kind]); старый объект удаляется.
   */
  async uploadMedia(actor: AuthUser, kind: StorefrontMediaKind, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");
    if (kind !== "LOGO" && kind !== "HERO") {
      throw new ValidationDomainError(`Invalid media kind "${String(kind)}"; allowed: LOGO, HERO`);
    }
    if (!file?.buffer) {
      throw new ValidationDomainError("No file provided for upload");
    }

    const processed = await this.processor.processImage(file.buffer);
    const mediaId = randomUUID();
    const key = `storefronts/${sf.id}/${kind.toLowerCase()}/${mediaId}.webp`;
    const uploadedKey = key;
    try {
      // Storefront media: единый derivative (large.webp ≤ 1600px) — подходит и для
      // logo (квадрат сохраняется, fit inside) и для hero-баннера.
      await this.storage.putObject({ key, body: processed.large, contentType: "image/webp" });
    } catch (err) {
      throw new ValidationDomainError(`Storage unavailable: ${(err as Error).message}`);
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.storefrontMedia.findUnique({
          where: { storefrontId_kind: { storefrontId: sf.id, kind } },
        });
        let mediaRow;
        if (existing) {
          mediaRow = await tx.storefrontMedia.update({
            where: { id: existing.id },
            data: {
              storageKey: key,
              mimeType: "image/webp",
              size: processed.large.length,
              width: processed.width,
              height: processed.height,
              originalFileName: file.originalname || `${kind.toLowerCase()}.webp`,
              createdById: actor.id,
            },
          });
        } else {
          mediaRow = await tx.storefrontMedia.create({
            data: {
              id: mediaId,
              storefrontId: sf.id,
              kind,
              storageKey: key,
              mimeType: "image/webp",
              size: processed.large.length,
              width: processed.width,
              height: processed.height,
              originalFileName: file.originalname || `${kind.toLowerCase()}.webp`,
              createdById: actor.id,
            },
          });
        }
        if (existing) {
          // Compensating/best-effort cleanup старого объекта после успешного update.
          await this.safeDelete(existing.storageKey);
        }
        await this.security.audit(tx, {
          userId: actor.id,
          username: actor.username,
          action: "storefront.media_uploaded",
          resource: "PartnerStorefront",
          resourceId: sf.id,
          details: { partnerId, storefrontId: sf.id, mediaId: mediaRow.id, kind: String(kind), replaced: Boolean(existing) },
        });
        return mediaRow;
      });
      this.logger.log(`Storefront ${sf.code} media ${String(kind)} uploaded (${row.id})`);
      return this.toView({ ...sf, media: await this.listMediaRows(sf.id) });
    } catch (err) {
      await this.safeDelete(uploadedKey);
      throw err;
    }
  }

  /** Delete logo|hero (own-scope). Запись и объект удаляются; витрина не удаляется. */
  async deleteMedia(actor: AuthUser, kind: StorefrontMediaKind): Promise<StorefrontView> {
    const partnerId = await this.assertEligible(actor);
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { partnerId },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    if (!sf) throw new NotFoundError("Storefront not found");
    const existing = await this.prisma.storefrontMedia.findUnique({
      where: { storefrontId_kind: { storefrontId: sf.id, kind } },
    });
    if (!existing) throw new NotFoundError(`Storefront ${String(kind)} media not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.storefrontMedia.delete({ where: { id: existing.id } });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "storefront.media_deleted",
        resource: "PartnerStorefront",
        resourceId: sf.id,
        details: { partnerId, storefrontId: sf.id, mediaId: existing.id, kind: String(kind) },
      });
    });
    await this.safeDelete(existing.storageKey);
    return this.toView({ ...sf, media: await this.listMediaRows(sf.id) });
  }

  /**
   * Short-lived signed preview URL для media витрины (owner-only preview):
   * DRAFT/INACTIVE/staged media видны владельцу, НЕ публикуют витрину.
   * Байты остаются приватными (signed, 5 min).
   */
  async signedPreviewMediaUrl(actor: AuthUser, mediaId: string): Promise<{ url: string; expiresIn: number; mediaId: string }> {
    const partnerId = await this.assertEligible(actor);
    const media = await this.prisma.storefrontMedia.findFirst({ where: { id: mediaId, storefront: { partnerId } } });
    if (!media) throw new NotFoundError("Storefront media not found");
    const url = await this.storage.getSignedReadUrl(media.storageKey, 300);
    return { url, expiresIn: 300, mediaId };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async listMediaRows(storefrontId: string) {
    return this.prisma.storefrontMedia.findMany({ where: { storefrontId }, orderBy: { createdAt: "asc" } });
  }

  private async safeDelete(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch {
      // best-effort
    }
  }

  /** Anti-disintermediation policy (Step 1.11) на free-text поля витрины. */
  private assertContentPolicy(
    input: { businessName?: string | null; tagline?: string | null; description?: string | null },
    phase: "create" | "update" | "activate",
  ): void {
    this.antiDisintermediation.assertNoViolations([
      { value: input.businessName ?? null, field: "businessName" },
      { value: input.tagline ?? null, field: "tagline" },
      { value: input.description ?? null, field: "description" },
    ]);
    void phase; // фаза фиксируется в audit/логах вызывающего
  }

  /** Валидация structured contacts (Step 1.12.2 §4) — формат email/phone/URL. */
  private assertContacts(input: {
    publicPhone: string | null;
    publicEmail: string | null;
    websiteUrl: string | null;
    whatsapp: string | null;
    socialLinks: SocialLinkInput[] | null;
  }): void {
    if (input.publicEmail && !EMAIL_RE.test(input.publicEmail)) {
      throw new ValidationDomainError(`Invalid publicEmail "${input.publicEmail}"`);
    }
    if (input.publicPhone && !PHONE_RE.test(input.publicPhone)) {
      throw new ValidationDomainError(`Invalid publicPhone "${input.publicPhone}"`);
    }
    if (input.websiteUrl && !URL_RE.test(input.websiteUrl)) {
      throw new ValidationDomainError(`Invalid websiteUrl "${input.websiteUrl}" (http(s) URL required)`);
    }
    if (input.whatsapp && !/^\+?[0-9\s\-()]{7,20}$/.test(input.whatsapp)) {
      throw new ValidationDomainError(`Invalid whatsapp "${input.whatsapp}" (phone number expected)`);
    }
    if (input.socialLinks) {
      if (!Array.isArray(input.socialLinks) || input.socialLinks.length > 10) {
        throw new ValidationDomainError("socialLinks must be an array of up to 10 entries");
      }
      for (const link of input.socialLinks) {
        if (!link || typeof link.platform !== "string" || typeof link.url !== "string") {
          throw new ValidationDomainError("Each social link must have platform and url");
        }
        if (!(SOCIAL_PLATFORMS as readonly string[]).includes(link.platform)) {
          throw new ValidationDomainError(`Unsupported social platform "${link.platform}"; allowed: ${SOCIAL_PLATFORMS.join(", ")}`);
        }
        if (link.platform.length > 40 || link.url.length > 500) {
          throw new ValidationDomainError("Social link platform/url too long");
        }
        if (!URL_RE.test(link.url)) {
          throw new ValidationDomainError(`Invalid social link url "${link.url}" (http(s) URL required)`);
        }
      }
    }
  }

  private assertLocale(locale: string | undefined): string {
    if (locale === undefined) return "ru";
    if (!(STOREFRONT_LOCALES as readonly string[]).includes(locale)) {
      throw new ValidationDomainError(`defaultLocale must be one of: ${STOREFRONT_LOCALES.join(", ")}`);
    }
    return locale;
  }

  private assertTheme(theme: string | undefined): string {
    if (!theme) return "default";
    if (!(STOREFRONT_THEMES as readonly string[]).includes(theme)) {
      throw new ValidationDomainError(`themePreset must be one of: ${STOREFRONT_THEMES.join(", ")}`);
    }
    return theme;
  }

  private toView(sf: {
    id: string;
    code: string;
    partnerId: string;
    slug: string;
    status: string;
    entitlementStatus: string;
    businessName: string | null;
    tagline: string | null;
    description: string | null;
    defaultLocale: string;
    countryCode: string | null;
    cityCode: string | null;
    publicPhone: string | null;
    publicEmail: string | null;
    websiteUrl: string | null;
    whatsapp: string | null;
    socialLinks: Prisma.JsonValue | null;
    heroHeading: string | null;
    heroSubheading: string | null;
    themePreset: string;
    createdAt: Date;
    updatedAt: Date;
    activatedAt: Date | null;
    deactivatedAt: Date | null;
    media?: Array<{ id: string; kind: string; mimeType: string; width: number | null; height: number | null; createdAt: Date }>;
  }): StorefrontView {
    const social = Array.isArray(sf.socialLinks)
      ? (sf.socialLinks as unknown as SocialLinkInput[])
      : null;
    return {
      id: sf.id,
      code: sf.code,
      partnerId: sf.partnerId,
      slug: sf.slug,
      status: sf.status,
      entitlementStatus: sf.entitlementStatus,
      businessName: sf.businessName,
      tagline: sf.tagline,
      description: sf.description,
      defaultLocale: sf.defaultLocale,
      countryCode: sf.countryCode,
      cityCode: sf.cityCode,
      publicPhone: sf.publicPhone,
      publicEmail: sf.publicEmail,
      websiteUrl: sf.websiteUrl,
      whatsapp: sf.whatsapp,
      socialLinks: social,
      heroHeading: sf.heroHeading,
      heroSubheading: sf.heroSubheading,
      themePreset: sf.themePreset,
      media: (sf.media ?? []).map((m) => ({
        id: m.id,
        kind: m.kind,
        mimeType: m.mimeType,
        width: m.width,
        height: m.height,
        createdAt: m.createdAt.toISOString(),
      })),
      publicUrl: `/store/${sf.slug}`,
      createdAt: sf.createdAt.toISOString(),
      updatedAt: sf.updatedAt.toISOString(),
      activatedAt: sf.activatedAt ? sf.activatedAt.toISOString() : null,
      deactivatedAt: sf.deactivatedAt ? sf.deactivatedAt.toISOString() : null,
    };
  }
}
