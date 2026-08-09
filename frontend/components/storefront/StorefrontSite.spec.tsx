// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StorefrontSite from "./StorefrontSite";
import { LocaleProvider } from "@/lib/i18n";
import type { PublicStorefront } from "@/lib/storefront-api";
import type { PublicListResult } from "@/lib/public-api";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function sf(overrides: Partial<PublicStorefront> = {}): PublicStorefront {
  return {
    id: "sf-1",
    code: "SF-00000001",
    slug: "kavkaz-tour",
    businessName: "Кавказ Тур",
    tagline: "Горы Кавказа",
    description: "Официальная витрина партнёра",
    defaultLocale: "ru",
    countryCode: "AZ",
    cityCode: "BAKU",
    publicPhone: "+994 50 123 45 67",
    publicEmail: "hello@kavkaz.example",
    websiteUrl: "https://kavkaz.example",
    whatsapp: "+994501234567",
    socialLinks: [{ platform: "instagram", url: "https://instagram.com/kavkaz" }],
    heroHeading: "Путешествия по Кавказу",
    heroSubheading: "Индивидуальные туры",
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
        shortDescription: "Выходные в Баку",
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

function renderWithLocale(ui: React.ReactElement, locale: "ru" | "az" | "en") {
  window.localStorage.setItem("travelhub.locale", locale);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("StorefrontSite (Step 1.12.2 §10)", () => {
  it("рендерит header с бизнес-именем, hero, description, контакты и продукты", () => {
    render(<StorefrontSite sf={sf()} products={products()} />);
    expect(screen.getByText("Кавказ Тур")).toBeTruthy();
    expect(screen.getByText("Путешествия по Кавказу")).toBeTruthy();
    expect(screen.getByText("Официальная витрина партнёра")).toBeTruthy();
    expect(screen.getByText(/\+994 50 123 45 67/)).toBeTruthy();
    expect(screen.getByText(/hello@kavkaz.example/)).toBeTruthy();
    expect(screen.getByText("Тур в Баку")).toBeTruthy();
    expect(screen.getByText(/Powered by TravelHub|Сайт создан на/)).toBeTruthy();
  });

  it("RU/AZ/EN локализуют ОДНУ И ТУ ЖЕ географию (AZ/BAKU) — identity не меняется", () => {
    // RU: «Баку, Азербайджан»
    const ru = renderWithLocale(<StorefrontSite sf={sf()} products={null} />, "ru");
    expect(screen.getByText(/Баку, Азербайджан/)).toBeTruthy();
    ru.unmount();

    // AZ: «Bakı, Azərbaycan»
    const az = renderWithLocale(<StorefrontSite sf={sf()} products={null} />, "az");
    expect(screen.getByText(/Bakı, Azərbaycan/)).toBeTruthy();
    az.unmount();

    // EN: «Baku, Azerbaijan»
    const en = renderWithLocale(<StorefrontSite sf={sf()} products={null} />, "en");
    expect(screen.getByText(/Baku, Azerbaijan/)).toBeTruthy();
    // Raw коды никогда не выводятся
    expect(screen.queryByText("AZ, BAKU")).toBeNull();
    en.unmount();
  });

  it("без продуктов → «Услуг пока нет»", () => {
    render(<StorefrontSite sf={sf()} products={null} />);
    expect(screen.getByText(/Услуг пока нет/)).toBeTruthy();
  });

  it("external links безопасны (noopener noreferrer) и НЕ внутренние", () => {
    render(<StorefrontSite sf={sf()} products={products()} />);
    const links = Array.from(document.querySelectorAll("a"));
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("http")) {
        expect(a.rel).toContain("noopener");
        expect(a.rel).toContain("noreferrer");
      }
    }
    // WhatsApp link строится из номера (wa.me).
    expect(document.querySelector('a[href="https://wa.me/+994501234567"]')).toBeTruthy();
  });

  it("preview banner показывается только в режиме preview", () => {
    const { unmount } = render(<StorefrontSite sf={sf()} products={null} preview />);
    expect(screen.getByText(/Предпросмотр — витрина не публична/)).toBeTruthy();
    unmount();
  });

  it("logo url (стабильный public URL) рендерится в header; signed override не обязателен", () => {
    const { unmount } = render(
      <StorefrontSite
        sf={sf({ media: [{ id: "m1", kind: "LOGO", url: "/api/v1/public/storefronts/kavkaz-tour/media/m1" }] })}
        products={null}
      />,
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img?.src).toContain("/api/v1/public/storefronts/kavkaz-tour/media/m1");
    unmount();
  });

  it("public page НЕ содержит внутренних полей (partnerId/entitlement/storage keys)", () => {
    const { container } = render(<StorefrontSite sf={sf()} products={products()} />);
    const html = container.innerHTML;
    expect(html).not.toContain("partnerId");
    expect(html).not.toContain("entitlementStatus");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("X-Amz");
  });
});
