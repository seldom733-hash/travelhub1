// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StorefrontPdp from "./StorefrontPdp";
import { LocaleProvider } from "@/lib/i18n";
import type { PublicStorefront } from "@/lib/storefront-api";
import type { PublicProductDetail } from "@/lib/public-api";

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

function detail(): PublicProductDetail {
  return {
    product: {
      id: "p1",
      code: "P-00000001",
      slug: "tour-baku",
      title: "Тур в Баку",
      description: "Выходные в Баку с гидом",
      type: "TOUR",
      category: { id: "c1", slug: "tours", title: "Tours" },
      attributes: null,
      tariffs: [{ id: "t1", name: "Стандарт", price: "120.00", currency: "USD", validFrom: null, validTo: null }],
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

beforeEach(() => {
  window.localStorage.clear();
});

describe("StorefrontPdp (Step 1.12.2 §11)", () => {
  it("рендерит канонический Product (title/description/tariff) + Storefront business identity/contacts", () => {
    renderWithLocale(<StorefrontPdp sf={sf()} detail={detail()} />);
    // title присутствует в breadcrumb и h1
    expect(screen.getAllByText("Тур в Баку").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Выходные в Баку с гидом")).toBeTruthy();
    expect(screen.getByText("Стандарт")).toBeTruthy();
    expect(screen.getAllByText("Кавказ Тур").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/\+994 50 123 45 67/)).toBeTruthy();
    expect(screen.getByText(/hello@kavkaz.example/)).toBeTruthy();
  });

  it("контакты — ТОЛЬКО Storefront-контекст; партнёрские/внутренние поля отсутствуют", () => {
    const { container } = renderWithLocale(<StorefrontPdp sf={sf()} detail={detail()} />);
    const html = container.innerHTML;
    expect(html).not.toContain("partnerId");
    expect(html).not.toContain("entitlementStatus");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("X-Amz");
  });

  it("external links безопасны (noopener noreferrer); tel/mailto/wa.me построены из structured-полей", () => {
    renderWithLocale(<StorefrontPdp sf={sf()} detail={detail()} />);
    const links = Array.from(document.querySelectorAll("a"));
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("http") || href.startsWith("https://wa.me")) {
        expect(a.rel).toContain("noopener");
        expect(a.rel).toContain("noreferrer");
      }
    }
    expect(document.querySelector('a[href="mailto:hello@kavkaz.example"]')).toBeTruthy();
    expect(document.querySelector('a[href="https://wa.me/+994501234567"]')).toBeTruthy();
    expect(document.querySelector('a[href="tel:+994501234567"]')).toBeTruthy();
  });

  it("RU/AZ/EN локализуют география (AZ/BAKU) — identity не меняется", () => {
    const ru = renderWithLocale(<StorefrontPdp sf={sf()} detail={detail()} />, "ru");
    expect(screen.getByText(/Баку, Азербайджан/)).toBeTruthy();
    ru.unmount();
    const az = renderWithLocale(<StorefrontPdp sf={sf()} detail={detail()} />, "az");
    expect(screen.getByText(/Bakı, Azərbaycan/)).toBeTruthy();
    az.unmount();
    const en = renderWithLocale(<StorefrontPdp sf={sf()} detail={detail()} />, "en");
    expect(screen.getByText(/Baku, Azerbaijan/)).toBeTruthy();
    expect(screen.queryByText("AZ, BAKU")).toBeNull();
    en.unmount();
  });

  it("без контактов — секция контактов не рендерит пустые ссылки", () => {
    const { container } = renderWithLocale(
      <StorefrontPdp sf={sf({ publicPhone: null, publicEmail: null, websiteUrl: null, whatsapp: null, socialLinks: null })} detail={detail()} />,
    );
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('a[href^="https://wa.me"]')).toBeNull();
  });
});
