// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StorefrontBlocks from "./StorefrontBlocks";
import { LocaleProvider } from "@/lib/i18n";
import type { PublicStorefront } from "@/lib/storefront-api";
import type { PageConfigView } from "@/lib/constructor-api";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const sf: PublicStorefront = {
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
  socialLinks: [],
  heroHeading: "Путешествия по Кавказу",
  heroSubheading: "Индивидуальные туры",
  themePreset: "forest",
  media: [],
  seller: null,
  activatedAt: "2026-08-09T00:00:00.000Z",
};

const page: PageConfigView = {
  id: "page-1",
  slug: "storefront-kavkaz-tour",
  context: "storefront",
  tenantId: "partner-1",
  status: "PUBLISHED",
  currentVersion: 1,
  draftVersion: null,
  themeId: null,
  templateId: null,
  seo: null,
  headerConfig: null,
  heroConfig: null,
  searchConfig: null,
  footerConfig: null,
  designConfig: null,
  createdAt: "",
  updatedAt: "",
  sections: [
    { id: "s1", blockType: "storefront-hero", blockInstanceId: "h1", sortOrder: 0, enabled: true, settings: { heading: "Сайт партнёра", subheading: "Подзаголовок", ctaLabel: "К турам", ctaHref: "#products" }, style: {}, responsive: {}, dataSource: {}, visibility: null, localeContent: {} },
    { id: "s2", blockType: "storefront-about", blockInstanceId: "a1", sortOrder: 1, enabled: true, settings: { heading: "О нас", body: "Наш текст о компании" }, style: {}, responsive: {}, dataSource: {}, visibility: null, localeContent: {} },
    { id: "s3", blockType: "storefront-contacts", blockInstanceId: "c1", sortOrder: 2, enabled: true, settings: { heading: "Связаться" }, style: {}, responsive: {}, dataSource: {}, visibility: null, localeContent: {} },
  ],
};

beforeEach(() => window.localStorage.clear());

describe("StorefrontBlocks", () => {
  it("renders published blocks in order with partner content", () => {
    render(<LocaleProvider><StorefrontBlocks sf={sf} products={null} page={page} /></LocaleProvider>);
    expect(screen.getByText("Сайт партнёра")).toBeTruthy();
    expect(screen.getByText("Наш текст о компании")).toBeTruthy();
    expect(screen.getByText("Связаться")).toBeTruthy();
    expect(screen.getByText(/\+994 50 123 45 67/)).toBeTruthy();
  });

  it("skips disabled and unknown blocks", () => {
    const withDisabled: PageConfigView = {
      ...page,
      sections: [
        { ...page.sections[0], enabled: false },
        { ...page.sections[1], blockType: "unknown-block", blockInstanceId: "u1" },
      ],
    };
    render(<LocaleProvider><StorefrontBlocks sf={sf} products={null} page={withDisabled} /></LocaleProvider>);
    expect(screen.queryByText("Сайт партнёра")).toBeNull();
    expect(screen.queryByText("Наш текст о компании")).toBeNull();
  });
});
