// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import type { AuthUser } from "@/lib/api";
import BuyerAccountLayout from "./layout";

const { useCurrentUserMock, routerReplaceMock } = vi.hoisted(() => ({
  useCurrentUserMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/account/orders",
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/use-user", () => ({ useCurrentUser: useCurrentUserMock }));

function buyerUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    code: "USR-00000001",
    username: "buyer",
    email: "buyer@test.local",
    fullName: "Покупатель Тестов",
    role: "BUYER",
    roleTitle: "Покупатель",
    partnerId: null,
    customerId: "CUS-00000001",
    permissions: ["account.profile.read", "account.order.read_own"],
    ...overrides,
  };
}

const NAV_LABELS = ["Обзор", "Профиль", "Заказы", "Бронирования", "Платежи", "Документы", "Поддержка"];

function renderLayout() {
  return render(
    <LocaleProvider>
      <BuyerAccountLayout>content</BuyerAccountLayout>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("travelhub.token", "jwt");
  routerReplaceMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BuyerAccountLayout (Step 1.13 §4)", () => {
  it("BUYER: рендерит canonical nav + buyer summary, без редиректа (§28.4)", async () => {
    useCurrentUserMock.mockReturnValue(buyerUser());
    await act(async () => {
      renderLayout();
    });
    for (const label of NAV_LABELS) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // Buyer summary: имя покупателя видно.
    expect(screen.getAllByText("Покупатель Тестов").length).toBeGreaterThan(0);
    // Роль BUYER → никакого редиректа из кабинета.
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it("PARTNER: не получает Buyer Cabinet — редирект в Partner Cabinet (§28.5, §3)", async () => {
    useCurrentUserMock.mockReturnValue(
      buyerUser({ role: "PARTNER", roleTitle: "Партнёр", partnerId: "PAR-00000001", customerId: null }),
    );
    await act(async () => {
      renderLayout();
    });
    expect(routerReplaceMock).toHaveBeenCalledWith("/partner");
    // Buyer nav не рендерится (placeholder до редиректа).
    expect(screen.queryByText("Бронирования")).toBeNull();
  });

  it("internal-роль: редирект в /app/dashboard (internal routing rules сохраняются)", async () => {
    useCurrentUserMock.mockReturnValue(
      buyerUser({ role: "ADMIN", roleTitle: "Администратор", customerId: null }),
    );
    await act(async () => {
      renderLayout();
    });
    expect(routerReplaceMock).toHaveBeenCalledWith("/app/dashboard");
  });

  it("anonymous (нет токена): нейтральный loading, никакой навигации кабинета (§28.3)", async () => {
    window.localStorage.removeItem("travelhub.token");
    useCurrentUserMock.mockReturnValue(null);
    await act(async () => {
      renderLayout();
    });
    expect(screen.queryByText("Заказы")).toBeNull();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it("mobile menu: hamburger открывает мобильную навигацию (§28.17)", async () => {
    useCurrentUserMock.mockReturnValue(buyerUser());
    await act(async () => {
      renderLayout();
    });
    // До клика — один «На витрину» (desktop), после клика добавляется mobile-ссылка.
    expect(screen.getAllByText("На витрину")).toHaveLength(1);
    await act(async () => {
      screen.getByRole("button", { name: "Меню" }).click();
    });
    expect(screen.getAllByText("На витрину")).toHaveLength(2);
    expect(screen.getAllByText("Выйти").length).toBeGreaterThan(0);
  });
});
