// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StorefrontSite from "@/components/storefront/StorefrontSite";
import StorefrontPdp from "@/components/storefront/StorefrontPdp";
import { LocaleProvider } from "@/lib/i18n";
import {
  fireContactClick,
  fireMarketplaceCta,
  fireMarketplaceFilter,
  fireMarketplaceSearch,
  fireMarketplaceSort,
  getOrCreateMarketplaceSessionId,
  getOrCreateSessionId,
  trackMarketplaceEvent,
  trackStorefrontEvent,
  useMarketplaceCardImpression,
  useMarketplaceCategoryViewed,
  useMarketplaceProductViewed,
  useMarketplaceViewed,
  useStorefrontViewed,
} from "@/lib/behavioral-events";
import type { PublicStorefront } from "@/lib/storefront-api";
import type { PublicListResult, PublicProductDetail } from "@/lib/public-api";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── fetch mock: перехватываем behavioral POST без Authorization ─────────────
const sent: Array<{ url: string; body: Record<string, unknown>; headers: HeadersInit }> = [];
const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  sent.push({
    url: String(input),
    body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    headers: (init?.headers ?? {}) as HeadersInit,
  });
  return new Response(JSON.stringify({ accepted: true }), { status: 202 });
});

function sf(overrides: Partial<PublicStorefront> = {}): PublicStorefront {
  return {
    id: "sf-1",
    code: "SF-00000001",
    slug: "kavkaz-tour",
    businessName: "Кавказ Тур",
    tagline: "Горы Кавказа",
    description: "Официальная витрина",
    defaultLocale: "ru",
    countryCode: "AZ",
    cityCode: "BAKU",
    publicPhone: "+994 50 123 45 67",
    publicEmail: "hello@kavkaz.example",
    websiteUrl: "https://kavkaz.example",
    whatsapp: "+994501234567",
    socialLinks: [{ platform: "instagram", url: "https://instagram.com/kavkaz" }],
    heroHeading: "Путешествия",
    heroSubheading: "Туры",
    themePreset: "forest",
    media: [],
    seller: null,
    activatedAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function products(): PublicListResult {
  return {
    items: [
      {
        id: "p1",
        slug: "tour-baku",
        title: "Тур в Баку",
        shortDescription: null,
        type: "TOUR",
        category: { id: "c1", slug: "tours", title: "Tours" },
        primaryImage: null,
        priceFrom: "120.00",
        currency: "USD",
        pricingUnit: "unit",
        availabilitySummary: null,
        seller: null,
        publishedAt: "2026-08-08T00:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    pageSize: 12,
  };
}

function detail(): PublicProductDetail {
  return {
    product: {
      id: "p1",
      code: "P-00000001",
      slug: "tour-baku",
      title: "Тур в Баку",
      description: "Выходные",
      type: "TOUR",
      category: { id: "c1", slug: "tours", title: "Tours" },
      attributes: null,
      tariffs: [],
      priceFrom: "120.00",
      currency: "USD",
      pricingUnit: "unit",
      availability: null,
      seller: null,
      publishedAt: "2026-08-08T00:00:00.000Z",
      version: 1,
    },
    media: [],
  };
}

function renderWithLocale(ui: React.ReactElement, locale: "ru" | "az" | "en" = "ru") {
  window.localStorage.setItem("travelhub.locale", locale);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

function FireOnceProbe({ enabled, slug = "kavkaz-tour" }: { enabled: boolean; slug?: string }) {
  useStorefrontViewed(slug, enabled);
  return <div>probe</div>;
}

beforeEach(() => {
  window.localStorage.clear();
  sent.length = 0;
  vi.stubGlobal("fetch", mockFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("behavioral-events client (Step 1.12.3)", () => {
  it("trackStorefrontEvent: корректный envelope, БЕЗ Authorization, keepalive, 202 необязателен", async () => {
    window.localStorage.setItem("travelhub.locale", "az");
    trackStorefrontEvent({
      slug: "kavkaz-tour",
      eventType: "STOREFRONT_VIEWED",
      path: "/store/kavkaz-tour",
    });
    expect(sent).toHaveLength(1);
    const { url, body, headers } = sent[0];
    expect(url).toBe("/api/v1/public/storefronts/kavkaz-tour/events");
    expect(headers).not.toHaveProperty("Authorization");
    expect(body.eventType).toBe("STOREFRONT_VIEWED");
    expect(body.locale).toBe("az");
    expect(body.path).toBe("/store/kavkaz-tour");
    expect(String(body.eventId)).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(String(body.occurredAt)))).toBe(false);
    expect(String(body.sessionId)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(body).not.toHaveProperty("authenticatedUserId");
    expect(body).not.toHaveProperty("partnerId");
    expect(body).not.toHaveProperty("storefrontId");
  });

  it("fireContactClick: только contactType/platform, НИКОГДА contact value", () => {
    fireContactClick("kavkaz-tour", "PHONE");
    fireContactClick("kavkaz-tour", "SOCIAL", "instagram");
    expect(sent).toHaveLength(2);
    expect(sent[0].body.payload).toEqual({ contactType: "PHONE" });
    expect(JSON.stringify(sent[0].body)).not.toContain("+994");
    expect(JSON.stringify(sent[0].body)).not.toContain("hello@kavkaz.example");
    expect(sent[1].body.payload).toEqual({ contactType: "SOCIAL", platform: "instagram" });
  });

  it("sessionId: opaque, создаётся один раз, переживает refresh; malformed — пересоздаётся", () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(a).not.toContain("kavkaz");
    expect(a).not.toContain("@");
    window.localStorage.setItem("travelhub.sf.sessionId", "bad id with spaces");
    const c = getOrCreateSessionId();
    expect(c).not.toBe(a);
    expect(c).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("tracking failure не ломает страницу (fire-and-forget, без retry loop)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    expect(() => trackStorefrontEvent({ slug: "kavkaz-tour", eventType: "STOREFRONT_VIEWED", path: "/store/kavkaz-tour" })).not.toThrow();
    expect(() => renderWithLocale(<StorefrontSite sf={sf()} products={products()} />)).not.toThrow();
    expect(screen.getByText("Тур в Баку")).toBeTruthy();
  });

  it("StrictMode double-mount: VIEWED и импрессии не дублируются (fire-once)", async () => {
    const { unmount } = render(
      <StrictMode>
        <LocaleProvider>
          <StorefrontSite sf={sf()} products={products()} />
        </LocaleProvider>
      </StrictMode>,
    );
    expect(screen.getByText("Тур в Баку")).toBeTruthy();
    const views = sent.filter((s) => s.body.eventType === "STOREFRONT_VIEWED");
    const impressions = sent.filter((s) => s.body.eventType === "STOREFRONT_PRODUCT_IMPRESSION");
    expect(views).toHaveLength(1);
    expect(impressions).toHaveLength(1);
    expect(impressions[0].body.productSlug).toBe("tour-baku");
    expect(impressions[0].body.payload).toEqual({ placement: "grid" });
    unmount();
  });

  it("preview: НЕ считается public StorefrontViewed и не шлёт импрессии", () => {
    renderWithLocale(<StorefrontSite sf={sf()} products={products()} preview />);
    expect(sent.filter((s) => s.body.eventType === "STOREFRONT_VIEWED")).toHaveLength(0);
    expect(sent.filter((s) => s.body.eventType === "STOREFRONT_PRODUCT_IMPRESSION")).toHaveLength(0);
  });

  it("клик по контакту в StorefrontSite шлёт CONTACT_CLICKED (PHONE/EMAIL/SOCIAL) без значения", () => {
    renderWithLocale(<StorefrontSite sf={sf()} products={products()} />);
    act(() => {
      screen.getByText(/\+994 50 123 45 67/).click();
    });
    act(() => {
      screen.getByText(/hello@kavkaz.example/).click();
    });
    act(() => {
      screen.getAllByRole("link").find((l) => (l.getAttribute("href") ?? "").includes("instagram.com"))?.click();
    });
    const clicks = sent.filter((s) => s.body.eventType === "STOREFRONT_CONTACT_CLICKED");
    expect(clicks).toHaveLength(3);
    expect(clicks.map((c) => (c.body.payload as { contactType: string }).contactType).sort()).toEqual(["EMAIL", "PHONE", "SOCIAL"]);
    for (const c of clicks) {
      expect(JSON.stringify(c.body)).not.toContain("+994");
      expect(JSON.stringify(c.body)).not.toContain("kavkaz.example");
    }
  });

  it("StorefrontPdp шлёт STOREFRONT_PRODUCT_VIEWED один раз + клики по контактам", () => {
    const { unmount } = render(
      <StrictMode>
        <LocaleProvider>
          <StorefrontPdp sf={sf()} detail={detail()} />
        </LocaleProvider>
      </StrictMode>,
    );
    const views = sent.filter((s) => s.body.eventType === "STOREFRONT_PRODUCT_VIEWED");
    expect(views).toHaveLength(1);
    expect(views[0].body.productSlug).toBe("tour-baku");
    expect(views[0].body.path).toBe("/store/kavkaz-tour/products/tour-baku");
    unmount();
  });

  it("locale RU/AZ/EN передаётся в каждый event", () => {
    renderWithLocale(<StorefrontSite sf={sf()} products={products()} />, "en");
    const views = sent.filter((s) => s.body.eventType === "STOREFRONT_VIEWED");
    expect(views[0].body.locale).toBe("en");
  });

  // ── Marketplace (Step 1.13B) ────────────────────────────────────────────

  it("trackMarketplaceEvent: /api/v1/public/marketplace/events, БЕЗ Authorization, корректный envelope", async () => {
    window.localStorage.setItem("travelhub.locale", "az");
    trackMarketplaceEvent({ eventType: "MARKETPLACE_VIEWED", path: "/" });
    expect(sent).toHaveLength(1);
    const { url, body, headers } = sent[0];
    expect(url).toBe("/api/v1/public/marketplace/events");
    expect(headers).not.toHaveProperty("Authorization");
    expect(body.eventType).toBe("MARKETPLACE_VIEWED");
    expect(body.locale).toBe("az");
    expect(body.path).toBe("/");
    expect(String(body.eventId)).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(String(body.occurredAt)))).toBe(false);
    expect(String(body.sessionId)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(body).not.toHaveProperty("acquisitionSource");
    expect(body).not.toHaveProperty("productId");
    expect(body).not.toHaveProperty("categoryId");
    expect(body).not.toHaveProperty("authenticatedUserId");
  });

  it("Marketplace sessionId: отдельный namespace, opaque, переживает refresh; malformed — пересоздаётся", () => {
    const a = getOrCreateMarketplaceSessionId();
    const b = getOrCreateMarketplaceSessionId();
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(a).not.toContain("@");
    expect(a).not.toContain("+");
    window.localStorage.setItem("travelhub.mp.sessionId", "bad id with spaces");
    expect(getOrCreateMarketplaceSessionId()).not.toBe(a);
  });

  it("marketplace impression: payload { placement: 'grid', position }; fire-once в StrictMode", () => {
    function Probe() {
      useMarketplaceCardImpression("tour-baku", 2, true);
      return <div>probe</div>;
    }
    const { unmount } = render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    const impressions = sent.filter((s) => s.body.eventType === "MARKETPLACE_PRODUCT_IMPRESSION");
    expect(impressions).toHaveLength(1);
    expect(impressions[0].body.productSlug).toBe("tour-baku");
    expect(impressions[0].body.payload).toEqual({ placement: "grid", position: 2 });
    unmount();
  });

  it("marketplace viewed/product/category: fire-once хуки", () => {
    function Probe() {
      useMarketplaceViewed(true);
      useMarketplaceProductViewed("tour-baku", true);
      useMarketplaceCategoryViewed("tours", true);
      return <div>probe</div>;
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    expect(sent.filter((s) => s.body.eventType === "MARKETPLACE_VIEWED")).toHaveLength(1);
    const pv = sent.filter((s) => s.body.eventType === "MARKETPLACE_PRODUCT_VIEWED");
    expect(pv).toHaveLength(1);
    expect(pv[0].body.productSlug).toBe("tour-baku");
    expect(pv[0].body.path).toBe("/products/tour-baku");
    const cv = sent.filter((s) => s.body.eventType === "MARKETPLACE_CATEGORY_VIEWED");
    expect(cv).toHaveLength(1);
    expect(cv[0].body.categorySlug).toBe("tours");
    expect(cv[0].body.path).toBe("/categories/tours");
  });

  it("search/filter/sort/cta fire-функции шлют корректные события без PII", () => {
    fireMarketplaceSearch("  Баку   тур ", "tours");
    fireMarketplaceFilter("tours", "days", "3");
    fireMarketplaceSort("price_asc");
    fireMarketplaceCta("tour-baku");
    const types = sent.map((s) => s.body.eventType);
    expect(types).toEqual(["MARKETPLACE_SEARCH_PERFORMED", "MARKETPLACE_FILTER_APPLIED", "MARKETPLACE_SORT_CHANGED", "MARKETPLACE_CTA_CLICKED"]);
    const search = sent[0].body;
    // Клиент шлёт trim; collapse-whitespace/усечение/privacy-guard — серверная
    // нормализация (e2e marketplace-behavioral #11 проверяет «Баку тур» после сервера).
    expect((search.payload as { query: string }).query).toBe("Баку   тур".trim());
    expect(search.categorySlug).toBe("tours");
    expect(sent[1].body.payload).toEqual({ key: "days", value: "3" });
    expect(sent[2].body.payload).toEqual({ sort: "price_asc" });
    expect(sent[3].body.productSlug).toBe("tour-baku");
    for (const s of sent) {
      expect(JSON.stringify(s.body)).not.toContain("+994");
      expect(JSON.stringify(s.body)).not.toContain("@");
      expect(JSON.stringify(s.body)).not.toContain("https://");
    }
  });

  it("marketplace search без текста → payload без query (category-only search)", () => {
    fireMarketplaceSearch("", "tours");
    const body = sent[0].body;
    expect(body.eventType).toBe("MARKETPLACE_SEARCH_PERFORMED");
    expect(body.payload).toBeUndefined();
    expect(body.categorySlug).toBe("tours");
  });

  it("marketplace tracking failure не бросает и не ломает UI", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    expect(() => trackMarketplaceEvent({ eventType: "MARKETPLACE_VIEWED", path: "/" })).not.toThrow();
    expect(() => fireMarketplaceCta("tour-baku")).not.toThrow();
  });
});
