import { api } from "./api";
import type { BlockDefinition, PageConfigView, PageSectionInput } from "./constructor-api";

export interface StorefrontPageSummary {
  id: string;
  slug: string;
  name: string;
  isHome: boolean;
  published: boolean;
}

function pageQuery(pageId?: string): string {
  return pageId ? `?pageId=${encodeURIComponent(pageId)}` : "";
}

/**
 * Tenant-scoped partner Storefront builder API.
 * Partner id is resolved server-side from the authenticated session; it is
 * never accepted from the client.
 */
export const storefrontConstructorApi = {
  getPage(pageId?: string): Promise<PageConfigView> {
    return api.get<PageConfigView>(`/partner/storefront/builder${pageQuery(pageId)}`);
  },
  getPages(): Promise<StorefrontPageSummary[]> {
    return api.get<StorefrontPageSummary[]>("/partner/storefront/builder/pages");
  },
  createPage(input: { name: string; slug: string }): Promise<PageConfigView> {
    return api.post<PageConfigView>("/partner/storefront/builder/pages", input);
  },
  getRegistry(): Promise<BlockDefinition[]> {
    return api.get<BlockDefinition[]>("/partner/storefront/builder/registry");
  },
  saveDraft(sections: PageSectionInput[], pageId?: string): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/partner/storefront/builder/sections${pageQuery(pageId)}`, { sections });
  },
  publish(pageId?: string): Promise<PageConfigView> {
    return api.post<PageConfigView>(`/partner/storefront/builder/publish${pageQuery(pageId)}`);
  },
  getPreview(pageId?: string): Promise<PageConfigView> {
    return api.get<PageConfigView>(`/partner/storefront/builder/preview${pageQuery(pageId)}`);
  },
  saveSeo(input: { title: string; description: string }, pageId?: string): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/partner/storefront/builder/seo${pageQuery(pageId)}`, input);
  },
  saveDesign(input: { accentColor: string; fontFamily: string }, pageId?: string): Promise<PageConfigView> {
    return api.put<PageConfigView>(`/partner/storefront/builder/design${pageQuery(pageId)}`, input);
  },
};
