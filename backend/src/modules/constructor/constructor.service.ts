import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { BLOCK_REGISTRY, getBlockDefinition, getBlocksForContext } from "./block-registry";
import type { BlockRegistryEntry } from "./block-registry";

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

  // ─── Block Registry ──────────────────────────────────────────────────

  getRegistry(context: string): BlockRegistryEntry[] {
    return getBlocksForContext(context);
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
