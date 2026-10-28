// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarketplaceContentBlock from "./MarketplaceContentBlock";
import { LocaleProvider } from "@/lib/i18n";
import type { SectionView } from "@/lib/constructor-api";

function section(overrides: Partial<SectionView>): SectionView {
  return {
    id: "s1",
    blockType: "content-about",
    blockInstanceId: "b1",
    sortOrder: 0,
    enabled: true,
    settings: {},
    style: {},
    responsive: {},
    dataSource: {},
    visibility: null,
    localeContent: {},
    ...overrides,
  };
}

describe("MarketplaceContentBlock", () => {
  it("renders shared About/CTA/FAQ blocks for the platform", () => {
    const { rerender } = render(
      <LocaleProvider>
        <MarketplaceContentBlock section={section({ settings: { heading: "О платформе", body: "Наш текст" } })} />
      </LocaleProvider>,
    );
    expect(screen.getByText("О платформе")).toBeTruthy();
    expect(screen.getByText("Наш текст")).toBeTruthy();

    rerender(
      <LocaleProvider>
        <MarketplaceContentBlock
          section={section({
            blockType: "content-faq",
            settings: { heading: "FAQ", itemsText: "Как купить? | Выберите тур\nКак оплатить? | Картой" },
          })}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText("Как купить?")).toBeTruthy();
    expect(screen.getByText("Картой")).toBeTruthy();
  });
});
