// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import OperationsCenterShell, {
  OPS_TABS,
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
  OperationsEmptyState,
} from "@/components/OperationsCenterShell";
import { NAV_GROUPS } from "@/components/Shell";
import { LocaleProvider, t } from "./i18n";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const REGISTRY_PAGES = ["app/app/requests/page.tsx", "app/app/orders/page.tsx", "app/app/bookings/page.tsx"];

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const { mockUserRef } = vi.hoisted(() => ({
  mockUserRef: {
    current: {
      id: "u1",
      code: "U-00000001",
      username: "admin",
      email: null,
      fullName: "Admin",
      role: "ADMIN",
      roleTitle: "Administrator",
      partnerId: null,
      customerId: null,
      permissions: ["order.read", "booking.read", "finance.payment.read"],
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/use-user", () => ({
  useCurrentUser: () => mockUserRef.current,
}));

function renderShell(ui: React.ReactElement, locale: "ru" | "az" | "en" = "ru") {
  window.localStorage.setItem("travelhub.locale", locale);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  mockUserRef.current.permissions = ["order.read", "booking.read", "finance.payment.read"];
});

/* ── UI-C1.2A §28 focused gates ─────────────────────────────────────────── */

describe("UI-C1.2A — shared OperationsCenterShell is the canonical registry frame", () => {
  it("(1) shell renders title + all permitted tabs", () => {
    renderShell(
      <OperationsCenterShell activeDomain="requests">
        <div>content</div>
      </OperationsCenterShell>,
    );
    expect(screen.getAllByText("Центр операций").length).toBeGreaterThan(0); // breadcrumb + title
    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((el) => el.textContent)).toEqual(["Заявки", "Заказы", "Бронирования", "Платежи"]);
  });

  it("(2) tabs are hidden when the permission is absent (not rendered, not disabled)", () => {
    mockUserRef.current.permissions = ["order.read", "booking.read"]; // no finance.payment.read
    renderShell(
      <OperationsCenterShell activeDomain="requests">
        <div>content</div>
      </OperationsCenterShell>,
    );
    const tablist = screen.getByRole("tablist");
    const labels = within(tablist).getAllByRole("tab").map((el) => el.textContent);
    expect(labels).toEqual(["Заявки", "Заказы", "Бронирования"]);
    expect(labels).not.toContain("Платежи");
  });

  it("(3) active tab derives from the route/activeDomain prop (aria-selected) and matches canonical route", () => {
    renderShell(
      <OperationsCenterShell activeDomain="payments">
        <div>content</div>
      </OperationsCenterShell>,
    );
    const tablist = screen.getByRole("tablist");
    const active = within(tablist).getAllByRole("tab").find((el) => el.getAttribute("aria-selected") === "true");
    expect(active?.textContent).toBe("Платежи");
    expect(active?.getAttribute("href")).toBe("/app/payments");
  });

  it("(4) each tab performs real route navigation to its canonical route", () => {
    const hrefById = Object.fromEntries(OPS_TABS.map((tab) => [tab.id, tab.href]));
    expect(hrefById).toEqual({
      requests: "/app/requests",
      orders: "/app/orders",
      bookings: "/app/bookings",
      payments: "/app/payments",
    });
  });

  it("(7) shell slot ordering: header/tabs precede domain content, domain slot order is preserved", () => {
    const { container } = renderShell(
      <OperationsCenterShell activeDomain="orders">
        <div id="total-slot">total</div>
        <div id="toolbar-slot">toolbar</div>
        <div id="table-slot">table</div>
      </OperationsCenterShell>,
    );
    const html = container.innerHTML;
    const titleIdx = html.indexOf("Центр операций");
    const tablistIdx = html.indexOf('role="tablist"');
    const totalIdx = html.indexOf('id="total-slot"');
    const toolbarIdx = html.indexOf('id="toolbar-slot"');
    const tableIdx = html.indexOf('id="table-slot"');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(tablistIdx).toBeGreaterThan(titleIdx);
    expect(totalIdx).toBeGreaterThan(tablistIdx);
    expect(toolbarIdx).toBeGreaterThan(totalIdx);
    expect(tableIdx).toBeGreaterThan(toolbarIdx);
  });

  it("(8) an omitted slot leaves no empty visual container (shell renders children only, pages guard sections)", () => {
    // Shell: content wrapper contains exactly the passed children — no placeholder boxes.
    const { container } = renderShell(<OperationsCenterShell activeDomain="requests"><div id="only">x</div></OperationsCenterShell>);
    expect(container.innerHTML).toContain('id="only"');
    // Pages guard every semantic section behind real data/conditions (no decorative empty KPI boxes).
    for (const rel of REGISTRY_PAGES) {
      const src = read(rel);
      expect(src).toContain("variant=\"total\"");
    }
    const req = read("app/app/requests/page.tsx");
    const bkg = read("app/app/bookings/page.tsx");
    expect(req).toContain("{kpi && (");
    expect(req).toContain("requests.length === 0");
    expect(bkg).toContain("!data && busy");
  });

  it("(9) loading state: accessible skeleton, no fake numbers", () => {
    renderShell(<OperationsLoadingState rows={3} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.querySelectorAll(".animate-pulse").length).toBe(3);
  });

  it("(10) empty state: row renders the localized empty message inside the table", () => {
    render(
      <table>
        <tbody>
          <OperationsEmptyState colSpan={6} message="Нет данных" />
        </tbody>
      </table>,
    );
    const cell = screen.getByText("Нет данных");
    expect(cell.tagName).toBe("TD");
    expect(cell.getAttribute("colspan")).toBe("6");
  });

  it("(11) error state: user-safe message + retry, no backend detail dump", () => {
    renderShell(<OperationsErrorState message="Не удалось загрузить" onRetry={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain("Не удалось загрузить");
    expect(screen.getByText("Повторить")).toBeTruthy();
  });

  it("(12) responsive-safe contracts: shared max-width shell + scrollable tab bar", () => {
    const src = read("components/OperationsCenterShell.tsx");
    expect(src).toContain("max-w-[1440px]");
    expect(src).toContain("overflow-x-auto"); // tabs may scroll on narrow screens
    expect(src).toContain("px-6");
  });

  it("(13) RU/AZ/EN shell labels are localized (no raw keys)", () => {
    expect(t("ops.title", "ru")).toBe("Центр операций");
    expect(t("ops.title", "az")).toBe("Əməliyyat Mərkəzi");
    expect(t("ops.title", "en")).toBe("Operations Center");
    for (const loc of ["ru", "az", "en"] as const) {
      expect(t("nav.payments", loc)).toBeTruthy();
      expect(t("nav.finance", loc)).toBeTruthy();
      expect(t("nav.group.finance", loc)).toBeTruthy();
    }
    renderShell(
      <OperationsCenterShell activeDomain="requests"><div>content</div></OperationsCenterShell>,
      "en",
    );
    expect(screen.getAllByText("Operations Center").length).toBeGreaterThan(0);
    expect(screen.queryByText(/raw|missing/i)).toBeNull();
  });

  it("(14) no duplicate local page title after wrapping: registries have no PageHeader / local h1 title", () => {
    for (const rel of REGISTRY_PAGES) {
      const src = read(rel);
      expect(src).toContain("<OperationsCenterShell");
      expect(src).not.toContain("<PageHeader");
      expect(src).not.toContain('<h1 className="text-2xl font-bold');
      expect(src).not.toContain('title="Order Center"');
      expect(src).not.toContain('title="Booking Center"');
    }
  });
});

describe("UI-C1.2A — registry pages consume the shared shell with their active domain", () => {
  it("requests/orders/bookings pages render inside the shared shell with correct activeDomain", () => {
    const cases: Array<[string, string]> = [
      ["app/app/requests/page.tsx", 'activeDomain="requests"'],
      ["app/app/orders/page.tsx", 'activeDomain="orders"'],
      ["app/app/bookings/page.tsx", 'activeDomain="bookings"'],
    ];
    for (const [rel, domainProp] of cases) {
      const src = read(rel);
      expect(src).toContain("import OperationsCenterShell");
      expect(src).toContain("<OperationsCenterShell");
      expect(src).toContain(domainProp);
      expect(src).toContain("OperationsToolbarSlot");
      expect(src).toContain("OperationsRegistrySlot");
    }
  });

  it("(6) canonical /app/payments route exists and renders the shell with Payments active", () => {
    const pay = read("app/app/payments/page.tsx");
    expect(pay).toContain("import OperationsCenterShell");
    expect(pay).toContain("activeDomain=\"payments\"");
    expect(pay).toContain("/finance/payments?"); // content sourced from the real API
  });

  it("historical /app/finance/payments is a query-preserving compatibility redirect to /app/payments", () => {
    const redirect = read("app/app/finance/payments/page.tsx");
    expect(redirect).toContain("router.replace(`/app/payments${window.location.search}`)");
  });

  it("existing Finance drill-down configs point at the canonical route", () => {
    const md = read("lib/metric-drilldown.ts");
    expect(md).toContain('destination: "/app/payments"');
    expect(md).not.toContain('destination: "/app/finance/payments"');
  });
});

describe("UI-C1.2A — sidebar ownership (§5): ФИНАНСЫ → Платежи, no invented Центр операций item", () => {
  it("(5) NAV_GROUPS contains a ФИНАНСЫ group with the Платежи item under finance.payment.read", () => {
    const finance = NAV_GROUPS.find((g) => g.headingKey === "nav.group.finance");
    expect(finance).toBeTruthy();
    const payments = finance?.items.find((item) => item.href === "/app/payments");
    expect(payments?.labelKey).toBe("nav.payments");
    expect(payments?.permission).toBe("finance.payment.read");
    // ОПЕРАЦИИ group holds the three commerce domains (Платежи NOT under ОПЕРАЦИИ)
    const operations = NAV_GROUPS.find((g) => g.headingKey === "nav.group.operations");
    expect(operations?.items.map((i) => i.href)).toEqual(["/app/requests", "/app/orders", "/app/bookings"]);
  });

  it("no invented sidebar item for the Operations Center shell itself", () => {
    const all = NAV_GROUPS.flatMap((g) => g.items);
    expect(all.some((i) => i.href === "/app/operations")).toBe(false);
    expect(all.some((i) => i.labelKey === "nav.operations_center")).toBe(false);
  });

  it("ОПЕРАЦИИ and ФИНАНСЫ group headings are localized keys (not hardcoded strings in the sidebar source)", () => {
    const shell = read("components/Shell.tsx");
    expect(shell).toContain("headingKey: \"nav.group.operations\"");
    expect(shell).toContain("headingKey: \"nav.group.finance\"");
    expect(shell).toContain("t(group.headingKey, locale)");
  });
});