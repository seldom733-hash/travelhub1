// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import { t } from "./i18n";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const PAGE = read("app/app/orders/page.tsx");
const LOCALES = ["ru", "az", "en"] as const;

/** The 12 ACTUAL canonical OrderStatus values (source of truth §4). */
const ORDER_STATUSES = [
  "NEW",
  "IN_PROCESSING",
  "WAITING_FOR_DATA",
  "READY_FOR_BOOKING",
  "SENT_TO_BOOKING",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "READY_TO_CLOSE",
  "CLOSED",
  "CANCELLED",
  "PROBLEM",
  "SUSPENDED",
] as const;

/** Canonical RU labels (order.status.* — single label source, §20/§25). */
const EXPECTED_RU: Record<string, string> = {
  NEW: "Новый",
  IN_PROCESSING: "В обработке",
  WAITING_FOR_DATA: "Ожидание данных",
  READY_FOR_BOOKING: "Готов к бронированию",
  SENT_TO_BOOKING: "Отправлен в бронирование",
  PARTIALLY_FULFILLED: "Частично выполнен",
  FULFILLED: "Выполнен",
  READY_TO_CLOSE: "Готов к закрытию",
  CLOSED: "Закрыт",
  CANCELLED: "Отменён",
  PROBLEM: "Проблема",
  SUSPENDED: "Приостановлен",
};

const ORDER_PAYMENTS = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"] as const;
const EXPECTED_PAYMENT_RU: Record<string, string> = {
  UNPAID: "Не оплачен",
  PARTIALLY_PAID: "Частично оплачен",
  PAID: "Оплачен",
  REFUNDED: "Возврат",
};

describe("UI-C1.2C §4/§6/§30 — all 12 OrderStatus values have a visible KPI card", () => {
  it("page enumerates every canonical OrderStatus exactly once across semantic groups", () => {
    for (const code of ORDER_STATUSES) {
      expect(PAGE).toContain(code);
    }
    // canonical full list (12) + the three group lists that split it
    expect(PAGE).toContain("ORDER_LIFECYCLE_STATUSES = [");
    expect(PAGE).toContain("ORDER_HAPPY_PATH");
    expect(PAGE).toContain("ORDER_REWORK_STATES");
    expect(PAGE).toContain("ORDER_EXCEPTION_STATES");
  });

  it("semantic groups partition all 12 statuses (lifecycle 6 + rework 3 + exceptions 3)", () => {
    const groupMembers: Record<string, string[]> = {
      lifecycle: ["NEW", "IN_PROCESSING", "READY_FOR_BOOKING", "SENT_TO_BOOKING", "FULFILLED", "CLOSED"],
      rework: ["WAITING_FOR_DATA", "PARTIALLY_FULFILLED", "READY_TO_CLOSE"],
      exceptions: ["PROBLEM", "SUSPENDED", "CANCELLED"],
    };
    const seen = [...groupMembers.lifecycle, ...groupMembers.rework, ...groupMembers.exceptions];
    expect(seen.sort()).toEqual([...ORDER_STATUSES].sort());
    for (const [grp, codes] of Object.entries(groupMembers)) {
      const arrName =
        grp === "lifecycle" ? "ORDER_HAPPY_PATH" : grp === "rework" ? "ORDER_REWORK_STATES" : "ORDER_EXCEPTION_STATES";
      const start = PAGE.indexOf(`${arrName} = [`);
      const end = PAGE.indexOf("] as const;", start);
      const arr = PAGE.slice(start, end);
      for (const code of codes) expect(arr).toContain(`"${code}"`);
    }
  });

  it("every status is rendered through a CommerceKpiCard inside its group loop", () => {
    expect(PAGE).toContain("ORDER_HAPPY_PATH.flatMap");
    expect(PAGE).toContain("ORDER_REWORK_STATES.map");
    expect(PAGE).toContain("ORDER_EXCEPTION_STATES.map");
    expect(PAGE).toContain("<CommerceKpiCard");
    const cardLoops = (PAGE.match(/(ORDER_HAPPY_PATH\.flatMap|ORDER_REWORK_STATES\.map|ORDER_EXCEPTION_STATES\.map|ORDER_PAYMENT_STATUSES\.map)/g) ?? []).length;
    expect(cardLoops).toBeGreaterThanOrEqual(4);
  });

  it("filter dropdown offers all 12 canonical statuses (nothing is filter-only — all have cards too)", () => {
    expect(PAGE).toContain("ORDER_LIFECYCLE_STATUSES.map((s) =>");
    expect(PAGE).toContain('<option value="">{t("admin.filter.all_statuses", locale)}</option>');
  });
});

describe("UI-C1.2C §7/§5/§12 — semantic grouping + no false transitions", () => {
  it("rework and exception statuses are never inside the happy-path lifecycle list", () => {
    const start = PAGE.indexOf("const ORDER_HAPPY_PATH = [");
    const end = PAGE.indexOf("] as const;", start);
    const happy = PAGE.slice(start, end);
    for (const code of ["WAITING_FOR_DATA", "PARTIALLY_FULFILLED", "READY_TO_CLOSE", "PROBLEM", "SUSPENDED", "CANCELLED"]) {
      expect(happy).not.toContain(code);
    }
  });

  it("READY_TO_CLOSE stays visible in the rework group but receives NO connector (no producer)", () => {
    expect(PAGE).toContain('"READY_TO_CLOSE"');
    const start = PAGE.indexOf("ORDER_REWORK_STATES");
    const reworkSection = PAGE.slice(start, start + 1200);
    expect(reworkSection).toContain("READY_TO_CLOSE");
    expect(reworkSection).not.toContain("aria-hidden");
    expect(reworkSection).not.toContain("svg");
  });

  it("connectors appear ONLY inside the happy-path lifecycle flow and only 5 of them", () => {
    expect(PAGE).toContain("decorative connector between adjacent happy-path cards");
    expect(PAGE).toContain("idx < ORDER_HAPPY_PATH.length - 1");
    // 5 connectors for the 6-card chain
    expect((PAGE.match(/conn-\${code}/g) ?? []).length).toBe(1);
    // exception / rework / payment groups carry no connectors or svg arrows
    const exceptionStart = PAGE.indexOf("ORDER_EXCEPTION_STATES.map");
    const exceptionSection = PAGE.slice(exceptionStart, exceptionStart + 900);
    expect(exceptionSection).not.toContain("aria-hidden=\"true\"");
    const paymentStart = PAGE.indexOf("ORDER_PAYMENT_STATUSES.map");
    const paymentSection = PAGE.slice(paymentStart, paymentStart + 900);
    expect(paymentSection).not.toContain("aria-hidden=\"true\"");
  });

  it("payment status dimension is rendered in its own group, never mixed into lifecycle", () => {
    expect(PAGE).toContain("orders.group.payment");
    const paymentStart = PAGE.indexOf("ORDER_PAYMENT_STATUSES.map");
    const paymentSection = PAGE.slice(paymentStart, paymentStart + 1000);
    expect(paymentSection).toContain('label={paymentLabel(code, locale)}');
    expect(paymentSection).toContain('active={selectedPayment === code}');
  });
});

describe("UI-C1.2C §8/§9 — Total + OrderPaymentStatus coverage", () => {
  it("4/4 OrderPaymentStatus are rendered as visible payment KPI cards", () => {
    for (const code of ORDER_PAYMENTS) expect(PAGE).toContain(code);
    expect(PAGE).toContain("ORDER_PAYMENT_STATUSES");
  });

  it("Total uses canonical «Всего заказов» label, variant=total, NOT full-width, not «Все заказы»", () => {
    expect(t("admin.kpi.total_orders", "ru")).toBe("Всего заказов");
    expect(t("admin.kpi.total_orders", "az")).toBeTruthy();
    expect(t("admin.kpi.total_orders", "en")).toBe("Total orders");
    expect(PAGE).toContain('label={t("admin.kpi.total_orders", locale)}');
    expect(PAGE).toContain('variant="total"');
    expect(PAGE).toContain('className="w-fit max-w-full"');
    expect(PAGE).not.toContain("Все заказы");
    expect(PAGE).not.toContain("w-full max-w-full");
  });

  it("Total click clears both applicable status dimensions and resets page → 1", () => {
    expect(PAGE).toContain("handleTotalClick");
    expect(PAGE).toContain('setStatusFilter("");');
    expect(PAGE).toContain('setPaymentStatusFilter("");');
  });
});

describe("UI-C1.2C §20/§25 — single canonical localized label source per status", () => {
  for (const code of ORDER_STATUSES) {
    const key = `order.status.${code}`;
    it(`${code}: order.status.* resolves in RU/AZ/EN and is the binding RU label`, () => {
      for (const loc of LOCALES) {
        const val = t(key, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("order.status.");
        expect(val).not.toBe(code);
      }
      expect(t(key, "ru")).toBe(EXPECTED_RU[code]);
    });
  }
  for (const code of ORDER_PAYMENTS) {
    const key = `order.payment.${code}`;
    it(`${code}: order.payment.* resolves in RU/AZ/EN and is the binding RU label`, () => {
      for (const loc of LOCALES) {
        const val = t(key, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("order.payment.");
        expect(val).not.toBe(code);
      }
      expect(t(key, "ru")).toBe(EXPECTED_PAYMENT_RU[code]);
    });
  }

  it("KPI cards, filters and table/detail badges all resolve through the same order.status.* helpers", () => {
    // card labels + filter options + table badge override + detail badge + history badges
    const lifecycleUses = (PAGE.match(/lifecycleLabel\(/g) ?? []).length;
    const paymentUses = (PAGE.match(/paymentLabel\(/g) ?? []).length;
    expect(lifecycleUses).toBeGreaterThanOrEqual(5);
    expect(paymentUses).toBeGreaterThanOrEqual(3);
    expect(PAGE).toContain("`order.status.${code}`");
    expect(PAGE).toContain("`order.payment.${code}`");
  });

  it("group headings are localized RU/AZ/EN (no raw keys, no hardcoded Cyrillic fallbacks)", () => {
    expect(t("orders.group.lifecycle", "ru")).toBe("Жизненный цикл");
    expect(t("orders.group.rework", "ru")).toBeTruthy();
    expect(t("orders.group.exceptions", "ru")).toBe("Исключения");
    expect(t("orders.group.payment", "ru")).toBeTruthy();
    for (const key of ["orders.group.lifecycle", "orders.group.rework", "orders.group.exceptions", "orders.group.payment"]) {
      for (const loc of LOCALES) {
        const val = t(key, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("orders.group.");
      }
    }
    expect(PAGE).toContain('t("orders.group.lifecycle", locale)');
    expect(PAGE).toContain('t("orders.group.rework", locale)');
    expect(PAGE).toContain('t("orders.group.exceptions", locale)');
    expect(PAGE).toContain('t("orders.group.payment", locale)');
  });
});

describe("UI-C1.2C §13/§19/§15 — KPI click contract (server-side, page→1, URL write)", () => {
  it("lifecycle card click applies canonical status + clears payment dimension + page → 1", () => {
    expect(PAGE).toContain("onClick={() => applyStatus(code)}");
    expect(PAGE).toContain('setStatusFilter(code);');
    expect(PAGE).toContain('setPaymentStatusFilter("");');
    expect(PAGE).toContain('updateUrl({ status: code || undefined, paymentStatus: undefined, page: undefined })');
  });

  it("payment card click applies paymentStatus + clears lifecycle + page → 1", () => {
    expect(PAGE).toContain("onClick={() => applyPaymentStatus(code)}");
    expect(PAGE).toContain('setPaymentStatusFilter(code);');
    expect(PAGE).toContain('setStatusFilter("");');
    expect(PAGE).toContain('updateUrl({ paymentStatus: code || undefined, status: undefined, page: undefined })');
  });

  it("selected lifecycle and payment cards get a programmatic selected state", () => {
    render(<CommerceKpiCard label="NEW" value={3} active />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    render(<CommerceKpiCard label="UNPAID" value={1} active={false} />);
    const btns = screen.getAllByRole("button");
    expect(btns[btns.length - 1].getAttribute("aria-pressed")).toBe("false");
  });

  it("cards are real buttons (accessible controls) and connectors are decorative (aria-hidden)", () => {
    expect(PAGE).toContain('aria-hidden="true"');
    expect(PAGE).toContain('aria-label={t("orders.group.lifecycle", locale)}');
  });
});

describe("UI-C1.2C §14/§32 — KPI/table same server scope, no client counting", () => {
  it("lifecycle/payment aggregates and the table come from ONE filtered list request", () => {
    expect(PAGE).toContain("api.get<Page<Order>>(`/orders?${qs.toString()}`)");
    expect(PAGE).not.toContain("/orders/kpi");
    expect(PAGE).not.toContain(".filter((o) =>");
    expect(PAGE).not.toContain(".reduce(");
  });

  it("KPI counts are read from server aggregates, never recomputed from page rows", () => {
    expect(PAGE).toContain("data?.aggregates?.lifecycle");
    expect(PAGE).toContain("data?.aggregates?.payment");
    expect(PAGE).toContain("lifecycleCounts[code] ?? 0");
    expect(PAGE).not.toContain("Math.round(");
  });

  it("status/payment/date filter params are sent to the same /orders query that returns KPI + table", () => {
    expect(PAGE).toContain('qs.set("status", statusFilter)');
    expect(PAGE).toContain('qs.set("paymentStatus", paymentStatusFilter)');
    expect(PAGE).toContain('qs.set("dateFrom", dateFrom)');
    expect(PAGE).toContain('qs.set("dateTo", dateTo)');
    expect(PAGE).toContain('qs.set("page", String(page))');
  });

  it("period IS exposed for Orders (aggregates + table share createdAt [from,to) scope parity)", () => {
    expect(PAGE).toContain('type="date"');
    expect(PAGE).toContain('t("common.date_from", locale)');
    expect(PAGE).toContain('t("common.date_to", locale)');
    expect(PAGE).toContain("applyDateFrom(e.target.value)");
    expect(PAGE).toContain("applyDateTo(e.target.value)");
  });

  it("no separate client-side KPI endpoint duplication — list is the only registry data source", () => {
    const getCalls = (PAGE.match(/api\.get</g) ?? []).length;
    expect(getCalls).toBeGreaterThanOrEqual(2); // list + detail quick preview
    expect(PAGE).not.toContain("setKpi(");
  });
});

describe("UI-C1.2C REMEDIATION R1 — stable KPI overview vs table-only filter", () => {
  it("KPI cards render overview counts from server aggregates, not the table scope", () => {
    expect(PAGE).toContain("REMEDIATION R1");
    expect(PAGE).toContain("lifecycleCounts[code] ?? 0");
    expect(PAGE).toContain("paymentCounts[code] ?? 0");
    // single server aggregate source — no second endpoint, no local re-scope state
    expect((PAGE.match(/api\.get</g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(PAGE).not.toContain("/orders/kpi");
    expect(PAGE).not.toContain(".filter((o) =>");
    expect(PAGE).not.toContain(".reduce(");
  });

  it("Total card value is the server OVERVIEW total (stable across KPI-card selection)", () => {
    expect(PAGE).toContain("const overviewTotal = (data?.aggregates?.lifecycle as Record<string, number> | undefined)?.total ?? data?.total ?? 0;");
    expect(PAGE).toContain("value={overviewTotal}");
    // Total never binds to the table-scope `total`
    const totalCardRegion = PAGE.slice(PAGE.indexOf("TOTAL KPI — canonical naming"), PAGE.indexOf("LIFECYCLE — truthful happy-path"));
    expect(totalCardRegion).not.toContain("value={total}");
  });

  it("table pagination still uses the TABLE scope total (items under active KPI filter)", () => {
    expect(PAGE).toContain("const total = data?.total ?? 0;");
    expect(PAGE).toContain("total={data.total}");
  });

  it("the active KPI selection is conveyed to the table query while overview is excluded server-side", () => {
    // status/paymentStatus stay table-scope params (server excludes them from the
    // overview aggregates — see backend order-kpi-scope), never client-recomputed
    expect(PAGE).toContain('qs.set("status", statusFilter)');
    expect(PAGE).toContain('qs.set("paymentStatus", paymentStatusFilter)');
    expect(PAGE).not.toContain("statusFilter.toLowerCase()");
  });
});

describe("UI-C1.2C §18/§23 — URL state, direct URL, Back/Forward, Reset", () => {
  it("canonical params read from URL on mount: search/status/paymentStatus/dateFrom/dateTo/page", () => {
    expect(PAGE).toContain("useSearchParams");
    expect(PAGE).toContain('sp.get("status")');
    expect(PAGE).toContain('sp.get("search")');
    expect(PAGE).toContain('sp.get("paymentStatus")');
    expect(PAGE).toContain('sp.get("from") ?? sp.get("dateFrom") ?? ""');
    expect(PAGE).toContain("history.replaceState");
  });

  it("filter/KPI interactions write the URL (replaceState — ADR-OPS-012)", () => {
    expect(PAGE).toContain('updateUrl({ search: value || undefined, page: undefined })');
    expect(PAGE).toContain('updateUrl({ dateFrom: value || undefined, page: undefined })');
    expect(PAGE).toContain('updateUrl({ dateTo: value || undefined, page: undefined })');
    expect(PAGE).toContain("handleTotalClick");
  });

  it("page param is written to the URL on pagination and restored on direct URL", () => {
    expect(PAGE).toContain('updateUrl({ page: p > 1 ? String(p) : undefined })');
    expect(PAGE).toContain("initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}");
  });

  it("page is wrapped in Suspense so deep-link useSearchParams works", () => {
    expect(PAGE).toContain("<Suspense");
    expect(PAGE).toContain("<OrdersWithParams />");
  });

  it("Reset clears search/status/paymentStatus/dates, page → 1, URL normalized", () => {
    expect(PAGE).toContain("const handleReset = useCallback(");
    expect(PAGE).toContain('setSearch("")');
    expect(PAGE).toContain('setStatusFilter("")');
    expect(PAGE).toContain('setPaymentStatusFilter("")');
    expect(PAGE).toContain('setDateFrom("")');
    expect(PAGE).toContain('setDateTo("")');
    expect(PAGE).toContain('updateUrl({ search: undefined, status: undefined, paymentStatus: undefined, dateFrom: undefined, dateTo: undefined, page: undefined })');
    expect(PAGE).toContain('t("filters.reset", locale)');
  });
});

describe("UI-C1.2C §16 — canonical toolbar order", () => {
  it("order is [Search][Lifecycle status][Payment status][From][To][Reset][CSV][XLSX]", () => {
    const searchIdx = PAGE.indexOf('placeholder={t("admin.search.placeholder_orders"');
    const statusIdx = PAGE.indexOf('aria-label={t("admin.filter.all_statuses"');
    const paymentIdx = PAGE.indexOf('aria-label={t("admin.filter.all_payments"');
    const fromIdx = PAGE.indexOf('t("common.date_from", locale)');
    const resetIdx = PAGE.indexOf('t("filters.reset", locale)');
    const exportIdx = PAGE.indexOf("<TableExportButton");
    expect(searchIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeGreaterThan(searchIdx);
    expect(paymentIdx).toBeGreaterThan(statusIdx);
    expect(fromIdx).toBeGreaterThan(paymentIdx);
    expect(resetIdx).toBeGreaterThan(fromIdx);
    expect(exportIdx).toBeGreaterThan(resetIdx);
  });

  it("export carries the same active server filters (status/paymentStatus/dates/search)", () => {
    expect(PAGE).toContain("extraParams={");
    expect(PAGE).toContain("...(paymentStatusFilter ? { paymentStatus: paymentStatusFilter } : {})");
    expect(PAGE).toContain("...(statusFilter ? { status: statusFilter } : {})");
  });
});

describe("UI-C1.2C §22/§28 — loading / empty / error states and locale formatting", () => {
  it("shared Operations Center loading/empty/error primitives are used", () => {
    expect(PAGE).toContain("OperationsLoadingState");
    expect(PAGE).toContain("OperationsEmptyState");
    expect(PAGE).toContain("OperationsErrorState");
    expect(PAGE).toContain("onRetry={() => void load()}");
  });

  it("money/dates are locale-aware via LOCALE_TAGS (no hardcoded ru-RU cells)", () => {
    expect(PAGE).toContain("LOCALE_TAGS[locale]");
    expect(PAGE).not.toContain('toLocaleDateString("ru-RU")');
    expect(PAGE).not.toContain('toLocaleString("ru-RU"');
  });

  it("search is server-side and debounced ~350 ms without blocking typing", () => {
    expect(PAGE).toContain("}, 350);");
    expect(PAGE).toContain("debounceRef.current = setTimeout");
    expect(PAGE).toContain("onKeyDown={onSearchKeyDown}");
  });
});

describe("UI-C1.2C §3/§24/§29 — shell + responsive-safe composition", () => {
  it("page renders inside the Operations Center shared shell (Orders active)", () => {
    expect(PAGE).toContain("<OperationsCenterShell");
    expect(PAGE).toContain('activeDomain="orders"');
    expect(PAGE).toContain("OperationsToolbarSlot");
    expect(PAGE).toContain("OperationsRegistrySlot");
    expect(PAGE).not.toContain("<PageHeader");
    expect(PAGE).not.toContain('<h1 className="text-2xl font-bold');
    expect(PAGE).not.toContain('title="Order Center"');
  });

  it("lifecycle happy-path row is a wrapping flow (2/3/4/6 responsive, one row at xl)", () => {
    expect(PAGE).toContain('className="flex flex-wrap gap-2 xl:flex-nowrap xl:gap-0"');
    expect(PAGE).toContain("xl:w-[calc((100%-5rem)/6)]");
    expect(PAGE).toContain('className="w-full"');
  });

  it("rework/exceptions/payment groups use the shared registry grid grammar (wrapping, no overflow)", () => {
    expect(PAGE).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-3"');
    expect(PAGE).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-4"');
  });

  it("total variant remains ~15-20% larger typographically (label text-sm vs text-xs, value 21px vs 18px)", () => {
    render(<CommerceKpiCard label="Всего заказов" value={508} variant="total" />);
    const totalLabel = screen.getByText("Всего заказов");
    expect(totalLabel.className).toContain("text-sm");
    const totalValue = screen.getByText("508");
    expect(totalValue.className).toContain("text-[21px]");
  });
});

describe("UI-C1.2C §19/§28 — D5/D7 preservation guards", () => {
  it("D5 order actions are still executed through the backend action endpoint only", () => {
    expect(PAGE).toContain("import OrderActionBar");
    expect(PAGE).toContain("api.patch(`/orders/${selected.id}`, { action })");
    expect(PAGE).toContain("availableActions");
  });

  it("no D7 finance recomputation introduced client-side (amounts render as server strings)", () => {
    expect(PAGE).toContain("fmtMoney(o.amount, o.currency, locale)");
    expect(PAGE).not.toContain("* 1.0");
    expect(PAGE).not.toContain("commission");
  });
});
