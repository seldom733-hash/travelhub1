// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PartnerStorefrontPage from "./page";
import type { StorefrontView } from "@/lib/storefront-api";

vi.mock("@/lib/storefront-api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    storefrontApi: {
      getOwn: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn(),
      uploadMedia: vi.fn(),
      deleteMedia: vi.fn(),
      previewMedia: vi.fn(async () => ({ url: "https://signed.example/x", expiresIn: 300, mediaId: "m1" })),
    },
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { storefrontApi } from "@/lib/storefront-api";

function view(overrides: Partial<StorefrontView> = {}): StorefrontView {
  return {
    id: "sf-1",
    code: "SF-00000001",
    partnerId: "PAR-00000001",
    slug: "kavkaz",
    status: "DRAFT",
    entitlementStatus: "NONE",
    businessName: "Кавказ Тур",
    tagline: null,
    description: null,
    defaultLocale: "ru",
    countryCode: "AZ",
    cityCode: null,
    publicPhone: null,
    publicEmail: null,
    websiteUrl: null,
    whatsapp: null,
    socialLinks: null,
    heroHeading: null,
    heroSubheading: null,
    themePreset: "default",
    media: [],
    publicUrl: "/store/kavkaz",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    activatedAt: null,
    deactivatedAt: null,
    ...overrides,
  };
}

const getOwnMock = storefrontApi.getOwn as ReturnType<typeof vi.fn>;
const updateMock = storefrontApi.update as ReturnType<typeof vi.fn>;
const activateMock = storefrontApi.activate as ReturnType<typeof vi.fn>;
const deactivateMock = storefrontApi.deactivate as ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  getOwnMock.mockReset();
  updateMock.mockReset();
  activateMock.mockReset();
  deactivateMock.mockReset();
  // previewMedia resolves по умолчанию (из mock-модуля).
});

describe("PartnerStorefrontPage (Step 1.12.2 §7 states)", () => {
  it("нет витрины → Create CTA (explicit provisioning)", async () => {
    getOwnMock.mockRejectedValueOnce(new Error("HTTP 404"));
    render(<PartnerStorefrontPage />);
    await waitFor(() => expect(screen.getByText("Создать витрину")).toBeTruthy());
    expect(screen.queryByText("Активировать")).toBeNull();
  });

  it("DRAFT + NONE: настройка разрешена, публикация заблокирована (объяснение платной capability)", async () => {
    getOwnMock.mockResolvedValueOnce(view());
    render(<PartnerStorefrontPage />);
    await waitFor(() => expect(screen.getByText(/Без подписки/)).toBeTruthy());
    expect(screen.getByText(/публикация станет возможна после активации платной capability/)).toBeTruthy();
    expect(screen.queryByText("Активировать")).toBeNull();
    expect(screen.queryByText(/Открыть публичную витрину/)).toBeNull();
  });

  it("DRAFT + ACTIVE entitlement: activate разрешён; save работает", async () => {
    getOwnMock.mockResolvedValueOnce(view({ entitlementStatus: "ACTIVE" }));
    updateMock.mockResolvedValueOnce(view({ entitlementStatus: "ACTIVE" }));
    render(<PartnerStorefrontPage />);
    await waitFor(() => expect(screen.getByText("Активировать")).toBeTruthy());
    // save: изменить businessName и сохранить (native value setter для React onChange)
    const nameInput = document.getElementById("sf-business") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(nameInput, "Новое имя");
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    screen.getByText("Сохранить").click();
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ businessName: "Новое имя" }));
  });

  it("ACTIVE + ACTIVE: публичный URL + deactivate; SUSPENDED: public site unavailable, конфигурация сохранена", async () => {
    getOwnMock.mockResolvedValueOnce(view({ status: "ACTIVE", entitlementStatus: "ACTIVE", activatedAt: "2026-08-09T10:00:00.000Z" }));
    const { unmount } = render(<PartnerStorefrontPage />);
    await waitFor(() => expect(screen.getByText(/Витрина публична/)).toBeTruthy());
    expect(screen.getByText(/Открыть публичную витрину/)).toBeTruthy();
    screen.getByText("Деактивировать").click();
    await waitFor(() => expect(deactivateMock).toHaveBeenCalled());
    unmount();

    getOwnMock.mockResolvedValueOnce(view({ status: "ACTIVE", entitlementStatus: "SUSPENDED", activatedAt: "2026-08-09T10:00:00.000Z" }));
    render(<PartnerStorefrontPage />);
    await waitFor(() => expect(screen.getByText(/публичный сайт недоступен/)).toBeTruthy());
    expect(screen.queryByText(/Открыть публичную витрину/)).toBeNull();
  });

  it("INACTIVE: редактирование разрешено; активация только при entitlement", async () => {
    getOwnMock.mockResolvedValueOnce(view({ status: "INACTIVE", entitlementStatus: "NONE", deactivatedAt: "2026-08-09T11:00:00.000Z" }));
    render(<PartnerStorefrontPage />);
    await waitFor(() => expect(screen.getByText(/Витрина деактивирована/)).toBeTruthy());
    expect(screen.queryByText("Активировать")).toBeNull(); // NONE entitlement
    // форма редактирования доступна
    expect(document.getElementById("sf-business")).toBeTruthy();
  });
});
