// ═══════════════════════════════════════════════════════════════════════════════
// Constructor API Client — Frontend types + API calls
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from "./api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlockCategory = "system" | "marketplace" | "content";

export interface BlockDefinition {
  type: string;
  version: number;
  category: BlockCategory;
  displayName: Record<string, string>;
  description: Record<string, string>;
  allowedContexts: string[];
  allowedLayouts: string[];
  defaultSettings: Record<string, unknown>;
  defaultLayout: string;
  singleton: boolean;
  removable: boolean;
  dataSourceType: string;
}

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
  createdAt: string;
  updatedAt: string;
}

// ─── API Client ──────────────────────────────────────────────────────────────

export const constructorApi = {
  /** Get page configuration (auto-creates marketplace-home if missing). */
  getPage(slug: string): Promise<PageConfigView> {
    return api.get<PageConfigView>(`/constructor/pages/${slug}`);
  },

  /** Save draft sections for a page. */
  saveDraft(slug: string, sections: PageSectionInput[]): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/constructor/pages/${slug}/sections`, { sections });
  },

  /** Publish draft to live. */
  publish(slug: string): Promise<PageConfigView> {
    return api.post<PageConfigView>(`/constructor/pages/${slug}/publish`);
  },

  /** Get preview (draft if exists, else published). */
  getPreview(slug: string): Promise<PageConfigView> {
    return api.get<PageConfigView>(`/constructor/pages/${slug}/preview`);
  },

  /** Get published (live) configuration. */
  getPublished(slug: string): Promise<PageConfigView | null> {
    return api.get<PageConfigView | null>(`/constructor/pages/${slug}/published`);
  },

  /** Save header config. */
  saveHeaderConfig(slug: string, config: Record<string, unknown>): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/constructor/pages/${slug}/header`, { config });
  },

  /** Save hero config. */
  saveHeroConfig(slug: string, config: Record<string, unknown>): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/constructor/pages/${slug}/hero`, { config });
  },

  /** Save search config. */
  saveSearchConfig(slug: string, config: Record<string, unknown>): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/constructor/pages/${slug}/search-config`, { config });
  },

  /** Save footer config. */
  saveFooterConfig(slug: string, config: Record<string, unknown>): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/constructor/pages/${slug}/footer`, { config });
  },

  /** Save design config. */
  saveDesignConfig(slug: string, config: Record<string, unknown>): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/constructor/pages/${slug}/design`, { config });
  },

  /** Upload media (logo/hero-slide). */
  uploadMedia(slug: string, file: File, kind: "logo" | "hero-slide"): Promise<{ url: string; width: number; height: number; size: number; format: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    return api.post(`/constructor/pages/${slug}/media`, formData);
  },

  /** Get block registry for a context. */
  getRegistry(context: string): Promise<BlockDefinition[]> {
    return api.get<BlockDefinition[]>(`/constructor/blocks/${context}`);
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function generateBlockInstanceId(blockType: string, existingIds: string[]): string {
  let candidate = `${blockType}-main`;
  let counter = 1;
  while (existingIds.includes(candidate)) {
    candidate = `${blockType}-${++counter}`;
  }
  return candidate;
}
