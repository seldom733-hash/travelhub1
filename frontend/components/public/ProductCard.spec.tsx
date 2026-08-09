// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductCard from "./ProductCard";
import type { PublicProductCard } from "@/lib/public-api";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function card(overrides: Partial<PublicProductCard> = {}): PublicProductCard {
  return {
    id: "p1",
    slug: "tour-1",
    title: "Тур на 5 дней",
    shortDescription: null,
    type: "TOUR",
    category: { id: "c1", slug: "tours", title: "Tours" },
    primaryImage: null,
    priceFrom: "350.00",
    currency: "USD",
    pricingUnit: "unit",
    availabilitySummary: null,
    seller: null,
    publishedAt: "2026-08-07T19:24:06.555Z",
    ...overrides,
  };
}

describe("ProductCard (Step 1.7 §7)", () => {
  it("рендерит категорию, title, цену (locale-aware) и CTA; ссылка на /products/:slug", () => {
    render(<ProductCard card={card()} />);
    expect(screen.getByText("Tours")).toBeTruthy();
    expect(screen.getByText("Тур на 5 дней")).toBeTruthy();
    // ru-RU USD: «от 350,00 $» (Intl — неразрывный пробел перед символом).
    expect(screen.getByText(/от 350,00\s*\$/)).toBeTruthy();
    expect(screen.getByText("Подробнее")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/products/tour-1");
  });

  it("без цены → «Цена по запросу», без 0", () => {
    render(<ProductCard card={card({ priceFrom: null, currency: null })} />);
    expect(screen.getByText("Цена по запросу")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("без image и без короткого описания не ломается", () => {
    render(<ProductCard card={card({ primaryImage: null, shortDescription: null })} />);
    expect(screen.getByText("Тур на 5 дней")).toBeTruthy();
  });

  it("с image рендерит thumbUrl в img", () => {
    render(
      <ProductCard
        card={card({
          primaryImage: { id: "m1", thumbUrl: "/api/v1/public/media/m1/thumb", largeUrl: "/api/v1/public/media/m1/large" },
        })}
      />,
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/api/v1/public/media/m1/thumb");
  });

  it("ANONYMOUS seller → generic label (никогда raw CRM name)", () => {
    render(
      <ProductCard
        card={card({
          seller: { publicId: "SELL-00000001", displayName: null, visibilityMode: "ANONYMOUS", verified: true, memberSince: "2026-07-01T00:00:00Z", countryCode: "AZ", cityCode: null },
        })}
      />,
    );
    expect(screen.getByText("Проверенный партнёр TravelHub")).toBeTruthy();
    const { container } = render(
      <ProductCard
        card={card({
          seller: { publicId: "SELL-00000001", displayName: null, visibilityMode: "ANONYMOUS", verified: true, memberSince: "2026-07-01T00:00:00Z", countryCode: "AZ", cityCode: null },
        })}
      />,
    );
    expect(container.innerHTML).not.toContain("RawBrand");
  });

  it("VERIFIED_ALIAS/PUBLIC_BRAND → approved displayName", () => {
    render(
      <ProductCard
        card={card({
          seller: { publicId: "SELL-00000002", displayName: "Smoke Travel", visibilityMode: "PUBLIC_BRAND", verified: true, memberSince: "2026-07-01T00:00:00Z", countryCode: "AZ", cityCode: "BAKU" },
        })}
      />,
    );
    expect(screen.getByText("Smoke Travel")).toBeTruthy();
    expect(screen.queryByText("Проверенный партнёр TravelHub")).toBeNull();
  });

  it("не рендерит internal-поля (status/partnerId/storage keys)", () => {
    const { container } = render(<ProductCard card={card()} />);
    const html = container.innerHTML;
    expect(html).not.toContain("partnerId");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("DRAFT");
  });
});
