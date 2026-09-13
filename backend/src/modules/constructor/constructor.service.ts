import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { BLOCK_REGISTRY, getBlockDefinition, getBlocksForContext } from "./block-registry";
import type { BlockRegistryEntry } from "./block-registry";
import { S3ObjectStorageService } from "../catalog/media/storage/s3-storage.service";
import { MediaProcessor } from "../catalog/media/media-processor.service";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PageSectionInput {
  blockType: string;
  blockInstanceId: string;
  sortOrder: number;
  enabled: boolean;
  settings?: Record<string, unknown>;
  style?: Record<string, unknown>;
  responsive?: Record<string, unknown>;
  dataSource?: Record<string, unknown>;
  visibility?: Record<string, unknown> | null;
  localeContent?: Record<string, unknown>;
}

export interface PageConfigView {
  id: string;
  slug: string;
  context: string;
  tenantId: string | null;
  status: string;
  currentVersion: number | null;
  draftVersion: number | null;
  themeId: string | null;
  templateId: string | null;
  seo: Record<string, unknown> | null;
  headerConfig: Record<string, unknown> | null;
  heroConfig: Record<string, unknown> | null;
  searchConfig: Record<string, unknown> | null;
  footerConfig: Record<string, unknown> | null;
  designConfig: Record<string, unknown> | null;
  sections: SectionView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SectionView {
  id: string;
  blockType: string;
  blockInstanceId: string;
  sortOrder: number;
  enabled: boolean;
  settings: Record<string, unknown>;
  style: Record<string, unknown>;
  responsive: Record<string, unknown>;
  dataSource: Record<string, unknown>;
  visibility: Record<string, unknown> | null;
  localeContent: Record<string, unknown>;
}

// ─── Default Home Configuration ──────────────────────────────────────────────

const DEFAULT_HOME_SECTIONS: PageSectionInput[] = [
  { blockType: "hero", blockInstanceId: "hero-main", sortOrder: 0, enabled: true },
  { blockType: "search", blockInstanceId: "search-main", sortOrder: 1, enabled: true },
  { blockType: "popular-destinations", blockInstanceId: "popular-destinations-main", sortOrder: 2, enabled: true },
  { blockType: "hot-tours", blockInstanceId: "hot-tours-main", sortOrder: 3, enabled: true },
  { blockType: "special-offers", blockInstanceId: "special-offers-main", sortOrder: 4, enabled: true },
  { blockType: "tours", blockInstanceId: "tours-main", sortOrder: 5, enabled: true },
  { blockType: "hotels", blockInstanceId: "hotels-main", sortOrder: 6, enabled: true },
  { blockType: "flights", blockInstanceId: "flights-main", sortOrder: 7, enabled: true },
  { blockType: "advertisement", blockInstanceId: "advertisement-main", sortOrder: 8, enabled: true },
  { blockType: "footer", blockInstanceId: "footer-main", sortOrder: 9, enabled: true },
];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ConstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly storage: S3ObjectStorageService,
    private readonly mediaProcessor: MediaProcessor,
  ) {}

  // ─── Page CRUD ───────────────────────────────────────────────────────

  async getPage(slug: string, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({
      where: { slug },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!page) {
      // Auto-create default marketplace-home page
      if (slug === "marketplace-home") {
        return this.createDefaultMarketplaceHome(actorId);
      }
      throw new NotFoundException(`Page "${slug}" not found`);
    }

    return this.mapPage(page);
  }

  async saveDraft(slug: string, sections: PageSectionInput[], actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    const newDraftVersion = (page.draftVersion ?? page.currentVersion ?? 0) + 1;

    // Validate all block types
    for (const section of sections) {
      if (!getBlockDefinition(section.blockType)) {
        throw new ForbiddenException(`Unknown block type: ${section.blockType}`);
      }
    }

    // Check singleton constraints
    const typeCounts = new Map<string, number>();
    for (const section of sections) {
      const count = (typeCounts.get(section.blockType) ?? 0) + 1;
      typeCounts.set(section.blockType, count);
      const def = getBlockDefinition(section.blockType);
      if (def?.singleton && count > 1) {
        throw new ForbiddenException(`Block type "${section.blockType}" is singleton and cannot be duplicated`);
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Delete old draft sections
        await tx.constructorPageSection.deleteMany({
          where: { pageId: page.id, version: page.draftVersion ?? page.currentVersion ?? 0 },
        });

        // Create new draft sections
        for (const section of sections) {
          const def = getBlockDefinition(section.blockType);
          await tx.constructorPageSection.create({
            data: {
              pageId: page.id,
              version: newDraftVersion,
              blockType: section.blockType,
              blockInstanceId: section.blockInstanceId,
              sortOrder: section.sortOrder,
              enabled: section.enabled,
              settings: (section.settings ?? def?.defaultSettings ?? {}) as any,
              style: (section.style ?? {}) as any,
              responsive: (section.responsive ?? {}) as any,
              dataSource: (section.dataSource ?? {}) as any,
              visibility: (section.visibility ?? null) as any,
              localeContent: (section.localeContent ?? {}) as any,
            },
          });
        }

        // Update page draft version
        await tx.constructorPage.update({
          where: { id: page.id },
          data: { draftVersion: newDraftVersion, status: "DRAFT" },
        });

        // Audit log
        try {
          await tx.constructorPageAuditLog.create({
            data: {
              pageId: page.id,
              version: newDraftVersion,
              action: "save_draft",
              actorId,
            },
          });
        } catch (auditErr) {
          console.warn("[ConstructorService] Audit log failed (non-critical):", auditErr);
        }
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ConstructorService] saveDraft failed:", msg, e);
      throw e;
    }

    return this.getPage(slug, actorId);
  }

  // ─── Publish / Preview ────────────────────────────────────────────────

  async publish(slug: string, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    const draftVersion = page.draftVersion;
    if (!draftVersion || draftVersion === page.currentVersion) {
      throw new BadRequestException("Nothing to publish — draft is same as current");
    }

    // Get draft sections
    const draftSections = await this.prisma.constructorPageSection.findMany({
      where: { pageId: page.id, version: draftVersion },
      orderBy: { sortOrder: "asc" },
    });

    // Validate all blocks
    for (const s of draftSections) {
      if (!getBlockDefinition(s.blockType)) {
        throw new ForbiddenException(`Unknown block type: ${s.blockType}`);
      }
    }

    const snapshot = {
      slug: page.slug,
      context: page.context,
      seo: page.seo,
      headerConfig: page.headerConfig,
      heroConfig: page.heroConfig,
      searchConfig: page.searchConfig,
      footerConfig: page.footerConfig,
      designConfig: page.designConfig,
      sections: draftSections.map((s) => ({
        blockType: s.blockType,
        blockInstanceId: s.blockInstanceId,
        sortOrder: s.sortOrder,
        enabled: s.enabled,
        settings: s.settings,
        style: s.style,
        responsive: s.responsive,
        dataSource: s.dataSource,
        visibility: s.visibility,
        localeContent: s.localeContent,
      })),
    };

    await this.prisma.$transaction(async (tx) => {
      // Create version snapshot
      await tx.constructorPageVersion.create({
        data: {
          pageId: page.id,
          version: draftVersion,
          status: "published",
          snapshot: snapshot as any,
          createdBy: actorId,
          publishedAt: new Date(),
        },
      });

      // Update page: promote draft → current
      await tx.constructorPage.update({
        where: { id: page.id },
        data: {
          currentVersion: draftVersion,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      // Audit log
      try {
        await tx.constructorPageAuditLog.create({
          data: {
            pageId: page.id,
            version: draftVersion,
            action: "publish",
            actorId,
            after: { version: page.draftVersion, sectionCount: draftSections.length },
          },
        });
      } catch (auditErr) {
        console.warn("[ConstructorService] Audit log failed (non-critical):", auditErr);
      }
    });

    return this.getPage(slug, actorId);
  }

  /** Get published (live) configuration — for public renderer. */
  async getPublished(slug: string): Promise<PageConfigView | null> {
    const page = await this.prisma.constructorPage.findUnique({
      where: { slug },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!page || !page.currentVersion) return null;

    // Only return published sections
    const publishedSections = await this.prisma.constructorPageSection.findMany({
      where: { pageId: page.id, version: page.currentVersion },
      orderBy: { sortOrder: "asc" },
    });

    // Page-level configs must come from the PUBLISHED version snapshot, not the
    // live page record — otherwise unpublished draft edits (header/hero/footer/
    // search/design saved to the page record) would leak to the public site
    // before Publish.
    const publishedVersion = await this.prisma.constructorPageVersion.findUnique({
      where: { pageId_version: { pageId: page.id, version: page.currentVersion } },
    });
    const snap = (publishedVersion?.snapshot ?? {}) as Record<string, unknown>;

    return {
      ...this.mapPage(page),
      seo: (snap.seo as Record<string, unknown> | null) ?? (page.seo as Record<string, unknown> | null),
      headerConfig: (snap.headerConfig as Record<string, unknown> | null) ?? null,
      heroConfig: (snap.heroConfig as Record<string, unknown> | null) ?? null,
      searchConfig: (snap.searchConfig as Record<string, unknown> | null) ?? null,
      footerConfig: (snap.footerConfig as Record<string, unknown> | null) ?? null,
      designConfig: (snap.designConfig as Record<string, unknown> | null) ?? null,
      sections: publishedSections.map((s) => ({
        id: s.id,
        blockType: s.blockType,
        blockInstanceId: s.blockInstanceId,
        sortOrder: s.sortOrder,
        enabled: s.enabled,
        settings: s.settings as Record<string, unknown>,
        style: s.style as Record<string, unknown>,
        responsive: s.responsive as Record<string, unknown>,
        dataSource: s.dataSource as Record<string, unknown>,
        visibility: s.visibility as Record<string, unknown> | null,
        localeContent: s.localeContent as Record<string, unknown>,
      })),
    };
  }

  /** Get preview (draft if exists, else published) — for admin preview. */
  async getPreview(slug: string, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({
      where: { slug },
      include: { sections: true },
    });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    // Use draft version if exists, otherwise current
    const version = page.draftVersion ?? page.currentVersion;
    if (!version) return this.getPage(slug, actorId);

    const sections = await this.prisma.constructorPageSection.findMany({
      where: { pageId: page.id, version },
      orderBy: { sortOrder: "asc" },
    });

    return {
      ...this.mapPage(page),
      sections: sections.map((s) => ({
        id: s.id,
        blockType: s.blockType,
        blockInstanceId: s.blockInstanceId,
        sortOrder: s.sortOrder,
        enabled: s.enabled,
        settings: s.settings as Record<string, unknown>,
        style: s.style as Record<string, unknown>,
        responsive: s.responsive as Record<string, unknown>,
        dataSource: s.dataSource as Record<string, unknown>,
        visibility: s.visibility as Record<string, unknown> | null,
        localeContent: s.localeContent as Record<string, unknown>,
      })),
    };
  }

  // ─── Page-level Config CRUD ──────────────────────────────────────────

  async saveHeaderConfig(slug: string, config: Record<string, unknown>, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    await this.prisma.constructorPage.update({
      where: { id: page.id },
      data: { headerConfig: config as any },
    });

    return this.getPage(slug, actorId);
  }

  async saveHeroConfig(slug: string, config: Record<string, unknown>, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    await this.prisma.constructorPage.update({
      where: { id: page.id },
      data: { heroConfig: config as any },
    });

    return this.getPage(slug, actorId);
  }

  async saveSearchConfig(slug: string, config: Record<string, unknown>, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    await this.prisma.constructorPage.update({
      where: { id: page.id },
      data: { searchConfig: config as any },
    });

    return this.getPage(slug, actorId);
  }

  async saveFooterConfig(slug: string, config: Record<string, unknown>, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    await this.prisma.constructorPage.update({
      where: { id: page.id },
      data: { footerConfig: config as any },
    });

    return this.getPage(slug, actorId);
  }

  async saveDesignConfig(slug: string, config: Record<string, unknown>, actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    await this.prisma.constructorPage.update({
      where: { id: page.id },
      data: { designConfig: config as any },
    });

    return this.getPage(slug, actorId);
  }

  // ─── Media Upload ────────────────────────────────────────────────────

  async uploadMedia(
    slug: string,
    file: Express.Multer.File,
    kind: "logo" | "hero-slide",
    actorId: string,
  ): Promise<{ url: string; storageKey: string; width: number; height: number; size: number; format: string }> {
    const page = await this.prisma.constructorPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Validate MIME type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP`);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB`);
    }

    // Process image to get dimensions
    let processed;
    try {
      processed = await this.mediaProcessor.processImage(file.buffer, [file.mimetype]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Image processing failed: ${msg}`);
    }

    // Validate dimensions for hero slides
    if (kind === "hero-slide") {
      if (processed.width < 1200 || processed.height < 400) {
        throw new BadRequestException(
          `Image too small: ${processed.width}×${processed.height}. Minimum for hero: 1200×400`,
        );
      }
    }

    // Upload to S3
    const ext = file.mimetype.split("/")[1] || "jpg";
    const key = `constructor/${slug}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    try {
      await this.storage.putObject({ key, body: file.buffer, contentType: file.mimetype });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ConstructorService] S3 upload failed:", msg);
      throw new BadRequestException(`Storage upload failed. Please try again later. Details: ${msg}`);
    }

    // Return metadata. URL points at the dedicated constructor media delivery
    // route (/api/v1/public/constructor-media/*), which 302-redirects to a
    // short-lived signed URL of the private bucket — same delivery strategy
    // as /api/v1/public/media/:mediaId/:derivative for ProductMedia.
    const format = file.mimetype.split("/")[1]?.toUpperCase() || "JPEG";
    return {
      url: `/api/v1/public/constructor-media?key=${encodeURIComponent(key)}`,
      storageKey: key,
      width: processed.width,
      height: processed.height,
      size: file.size,
      format,
    };
  }

  // ─── Block Registry ──────────────────────────────────────────────────

  getRegistry(context: string): BlockRegistryEntry[] {
    return getBlocksForContext(context);
  }

  // ─── Media delivery helpers (public constructor-media route) ─────────

  async storageKeyExists(key: string): Promise<boolean> {
    try {
      return await this.storage.objectExists(key);
    } catch {
      return false;
    }
  }

  async getMediaReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.storage.getSignedReadUrl(key, expiresInSeconds);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async createDefaultMarketplaceHome(actorId: string): Promise<PageConfigView> {
    const page = await this.prisma.constructorPage.create({
      data: {
        slug: "marketplace-home",
        context: "marketplace",
        status: "DRAFT",
        draftVersion: 1,
        seo: {
          title: { ru: "TravelHub — Туристический маркетплейс", az: "TravelHub — Turizm marketpleysi", en: "TravelHub — Travel Marketplace" },
          description: { ru: "Найдите лучшие туры, отели и авиабилеты", az: "Ən yaxşı turları tapın", en: "Find the best tours and hotels" },
          robots: "index",
        } as any,
      },
      include: { sections: true },
    });

    // Create default sections
    for (const section of DEFAULT_HOME_SECTIONS) {
      const def = getBlockDefinition(section.blockType);
      await this.prisma.constructorPageSection.create({
        data: {
          pageId: page.id,
          version: 1,
          blockType: section.blockType,
          blockInstanceId: section.blockInstanceId,
          sortOrder: section.sortOrder,
          enabled: section.enabled,
          settings: (def?.defaultSettings ?? {}) as any,
          dataSource: { type: def?.dataSourceType ?? "static-config", params: {}, cacheTtl: 60 } as any,
        },
      });
    }

    // Audit log
    await this.prisma.constructorPageAuditLog.create({
      data: {
        pageId: page.id,
        version: 1,
        action: "create",
        actorId,
        after: { slug: "marketplace-home", sectionCount: DEFAULT_HOME_SECTIONS.length },
      },
    });

    return this.getPage("marketplace-home", actorId);
  }

  private mapPage(page: any): PageConfigView {
    return {
      id: page.id,
      slug: page.slug,
      context: page.context,
      tenantId: page.tenantId,
      status: page.status,
      currentVersion: page.currentVersion,
      draftVersion: page.draftVersion,
      themeId: page.themeId,
      templateId: page.templateId,
      seo: page.seo as Record<string, unknown> | null,
      headerConfig: (page.headerConfig as Record<string, unknown>) ?? null,
      heroConfig: (page.heroConfig as Record<string, unknown>) ?? null,
      searchConfig: (page.searchConfig as Record<string, unknown>) ?? null,
      footerConfig: (page.footerConfig as Record<string, unknown>) ?? null,
      designConfig: (page.designConfig as Record<string, unknown>) ?? null,
      sections: page.sections.map((s: any) => ({
        id: s.id,
        blockType: s.blockType,
        blockInstanceId: s.blockInstanceId,
        sortOrder: s.sortOrder,
        enabled: s.enabled,
        settings: s.settings as Record<string, unknown>,
        style: s.style as Record<string, unknown>,
        responsive: s.responsive as Record<string, unknown>,
        dataSource: s.dataSource as Record<string, unknown>,
        visibility: s.visibility as Record<string, unknown> | null,
        localeContent: s.localeContent as Record<string, unknown>,
      })),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }
}
