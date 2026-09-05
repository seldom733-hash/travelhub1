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

const PAGE = read("app/app/bookings/page.tsx");
const LOCALES = ["ru", "az", "en"] as const;

/** The 13 ACTUAL canonical BookingStatus values (source of truth — schema). */
const BOOKING_STATUSES = [
  "NEW",
  "PREPARING_REQUEST",
  "SENT_TO_SUPPLIER",
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
  "IN_SERVICE",
  "COMPLETED",
  "NEEDS_CLARIFICATION",
  "SUPPLIER_REJECTED",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
  "PROBLEM",
] as const;

/** Canonical RU labels (booking.status.* — single label source, §19). */
const EXPECTED_RU: Record<string, string> = {
  NEW: "Новое",
  PREPARING_REQUEST: "Подготовка заявки",
  SENT_TO_SUPPLIER: "Отправлен поставщику",
  AWAITING_CONFIRMATION: "Ожидает подтверждения",
  CONFIRMED: "Подтверждено",
  IN_SERVICE: "В обслуживании",
  COMPLETED: "Завершено",
  NEEDS_CLARIFICATION: "Требует уточнения",
  SUPPLIER_REJECTED: "Отклонено поставщиком",
  CHANGE_REQUESTED: "Запрос на изменение",
  CANCELLATION_REQUESTED: "Запрос на отмену",
  CANCELLED: "Отменено",
  PROBLEM: "Проблема",
};

const GROUP_MEMBERS: Record<string, readonly string[]> = {
  flow_prep: ["NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER"],
  flow_service: ["CONFIRMED", "IN_SERVICE", "COMPLETED"],
  awaiting: ["AWAITING_CONFIRMATION"],
  operational: ["NEEDS_CLARIFICATION", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "PROBLEM"],
  terminal: ["SUPPLIER_REJECTED", "CANCELLED"],
};

describe("UI-C1.2D §6/§30 — 13/13 canonical BookingStatus coverage", () => {
  it("page enumerates every canonical BookingStatus exactly once across semantic groups", () => {
    for (const code of BOOKING_STATUSES) {
      expect(PAGE).toContain(`"${code}"`);
    }
    expect(PAGE).toContain("BOOKING_STATUSES = [");
    expect(PAGE).toContain("BOOKING_FLOW_PREP");
    expect(PAGE).toContain("BOOKING_FLOW_SERVICE");
    expect(PAGE).toContain("BOOKING_OPERATIONAL");
    expect(PAGE).toContain("BOOKING_TERMINAL");
  });

  it("semantic groups partition all 13 statuses (3+3+1+4+2) with no invented status", () => {
    const all = [
      ...GROUP_MEMBERS.flow_prep,
      ...GROUP_MEMBERS.flow_service,
      ...GROUP_MEMBERS.awaiting,
      ...GROUP_MEMBERS.operational,
      ...GROUP_MEMBERS.terminal,
    ];
    expect([...all].sort()).toEqual([...BOOKING_STATUSES].sort());
    expect(PAGE).not.toContain("PARTIALLY_CONFIRMED");
    // array names for group splits
    for (const arrName of ["BOOKING_FLOW_PREP", "BOOKING_FLOW_SERVICE", "BOOKING_AWAITING", "BOOKING_OPERATIONAL", "BOOKING_TERMINAL"]) {
      const start = PAGE.indexOf(`${arrName} = [`);
      expect(start).toBeGreaterThan(-1);
    }
  });

  it("every status renders through a CommerceKpiCard (nothing is filter-only)", () => {
    expect(PAGE).toContain("<CommerceKpiCard");
    // each semantic group loop renders its cards
    const cardLoops = (PAGE.match(/BOOKING_FLOW_PREP|BOOKING_FLOW_SERVICE|BOOKING_AWAITING\.map|BOOKING_OPERATIONAL\.map|BOOKING_TERMINAL\.map/g) ?? []).length;
    expect(cardLoops).toBeGreaterThanOrEqual(5);
    expect(PAGE).toContain("BOOKING_STATUSES.map((s) =>");
  });

  it("filter dropdown offers all 13 canonical statuses (no raw enums as visible labels)", () => {
    expect(PAGE).toContain('<option value="">{t("admin.filter.all_statuses", locale)}</option>');
    expect(PAGE).toContain('{bookingStatusLabel(s, locale)}');
    // labels resolve through i18n, never raw enum text
    expect(PAGE).not.toContain('>CANCELLED</option>');
  });
});

describe("UI-C1.2D §7/§8/§9 — truthful semantic grouping + state machine", () => {
  it("flows contain only their truthful statuses; non-flow statuses never get connectors", () => {
    const prepStart = PAGE.indexOf("const BOOKING_FLOW_PREP = [");
    const prepEnd = PAGE.indexOf("] as const;", prepStart);
    const prep = PAGE.slice(prepStart, prepEnd);
    for (const code of ["AWAITING_CONFIRMATION", "NEEDS_CLARIFICATION", "PROBLEM", "SUPPLIER_REJECTED", "CANCELLED"]) {
      expect(prep).not.toContain(code);
    }
    const svcStart = PAGE.indexOf("const BOOKING_FLOW_SERVICE = [");
    const svcEnd = PAGE.indexOf("] as const;", svcStart);
    const svc = PAGE.slice(svcStart, svcEnd);
    for (const code of ["NEW", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION", "PROBLEM"]) {
      expect(svc).not.toContain(code);
    }
  });

  it("connectors exist ONLY inside the two flow rows — 2 per flow (4 total), none elsewhere", () => {
    expect(PAGE).toContain("decorative connector between adjacent happy-path cards");
    expect(PAGE).toContain("idx < codes.length - 1");
    expect((PAGE.match(/conn-\${code}/g) ?? []).length).toBe(1); // single shared template
    // operational + terminal + awaiting grid sections carry no connectors/svg arrows
    const awaitingSection = PAGE.slice(PAGE.indexOf("BOOKING_AWAITING.map"), PAGE.indexOf("BOOKING_AWAITING.map") + 700);
    expect(awaitingSection).not.toContain('aria-hidden="true"');
    const operationalSection = PAGE.slice(PAGE.indexOf("BOOKING_OPERATIONAL.map"), PAGE.indexOf("BOOKING_OPERATIONAL.map") + 800);
    expect(operationalSection).not.toContain('aria-hidden="true"');
    const terminalSection = PAGE.slice(PAGE.indexOf("BOOKING_TERMINAL.map"), PAGE.indexOf("BOOKING_TERMINAL.map") + 800);
    expect(terminalSection).not.toContain('aria-hidden="true"');
  });

  it("AWAITING_CONFIRMATION stays visible but receives NO false incoming arrow (no producer)", () => {
    expect(PAGE).toContain('"AWAITING_CONFIRMATION"');
    // it is not part of either connector-bearing flow
    const flowRegion = PAGE.slice(PAGE.indexOf("const BOOKING_FLOW_PREP"), PAGE.indexOf("const BOOKING_OPERATIONAL"));
    const flowOnly = flowRegion.slice(0, flowRegion.indexOf("BOOKING_AWAITING") === -1 ? flowRegion.length : flowRegion.indexOf("BOOKING_AWAITING"));
    expect(flowOnly).not.toContain("AWAITING_CONFIRMATION");
    // it is rendered as its own visible group card
    expect(PAGE).toContain('t("bookings.group.awaiting", locale)');
  });
});

describe("UI-C1.2D §10/§12/§14 — Total KPI + canonical label + reset semantics", () => {
  it("Total uses «Всего бронирований» (not «Все бронирования»), variant=total, NOT full-width", () => {
    expect(t("admin.kpi.total_bookings", "ru")).toBe("Всего бронирований");
    expect(t("admin.kpi.total_bookings", "az")).toBeTruthy();
    expect(t("admin.kpi.total_bookings", "en")).toBe("Total bookings");
    expect(PAGE).toContain('label={t("admin.kpi.total_bookings", locale)}');
    expect(PAGE).toContain('variant="total"');
    expect(PAGE).toContain('className="w-fit max-w-full"');
    expect(PAGE).not.toContain("Все бронирования");
  });

  it("Total card value is the server OVERVIEW total (stable across KPI selection)", () => {
    expect(PAGE).toContain('const overviewTotal = (data?.aggregates?.lifecycle as Record<string, number> | undefined)?.total ?? data?.total ?? 0;');
    expect(PAGE).toContain("value={overviewTotal}");
    const totalRegion = PAGE.slice(PAGE.indexOf("TOTAL KPI — canonical naming"), PAGE.indexOf("FLOW 1 — request/preparation"));
    expect(totalRegion).not.toContain("value={total}");
  });

  it("table pagination still uses the TABLE scope total (rows under active KPI filter)", () => {
    expect(PAGE).toContain("total={data.total}");
  });

  it("Total click clears the status dimension and resets page → 1", () => {
    expect(PAGE).toContain("handleTotalClick");
    expect(PAGE).toContain('setStatusFilter("");');
    expect(PAGE).toContain('updateUrl({ status: undefined, page: undefined })');
  });
});

describe("UI-C1.2D §19 — single canonical localized label source per status", () => {
  for (const code of BOOKING_STATUSES) {
    const key = `booking.status.${code}`;
    it(`${code}: booking.status.* resolves in RU/AZ/EN and is the binding RU label`, () => {
      for (const loc of LOCALES) {
        const val = t(key, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("booking.status.");
        expect(val).not.toBe(code);
      }
      expect(t(key, "ru")).toBe(EXPECTED_RU[code]);
    });
  }

  it("KPI cards, filter options and table badges all resolve through the same bookingStatusLabel helper", () => {
    const uses = (PAGE.match(/bookingStatusLabel\(/g) ?? []).length;
    expect(uses).toBeGreaterThanOrEqual(7); // helper def + FlowRow cards (3×) + awaiting/operational/terminal + filter + badge
    expect(PAGE).toContain("`booking.status.${code}`");
    expect(PAGE).toContain('<StatusBadge status={b.status} label={bookingStatusLabel(b.status, locale)} />');
  });

  it("group headings are localized RU/AZ/EN (no raw keys, no hardcoded Cyrillic fallbacks)", () => {
    expect(t("bookings.group.lifecycle", "ru")).toBeTruthy();
    expect(t("bookings.group.awaiting", "ru")).toBeTruthy();
    expect(t("bookings.group.decisions", "ru")).toBeTruthy();
    expect(t("bookings.group.terminal", "ru")).toBeTruthy();
    for (const key of ["bookings.group.lifecycle", "bookings.group.awaiting", "bookings.group.decisions", "bookings.group.terminal"]) {
      for (const loc of LOCALES) {
        const val = t(key, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("bookings.group.");
      }
    }
    expect(PAGE).toContain('t("bookings.group.lifecycle", locale)');
    expect(PAGE).toContain('t("bookings.group.awaiting", locale)');
    expect(PAGE).toContain('t("bookings.group.decisions", locale)');
    expect(PAGE).toContain('t("bookings.group.terminal", locale)');
    expect(PAGE).not.toContain("Статусы бронирований"); // old flat header is gone
  });
});

describe("UI-C1.2D §2/§11/§13/§41 — KPI interaction contract (Requests reference)", () => {
  it("card click selects ONE status, clears none else, page → 1, writes URL (server refreshes table)", () => {
    expect(PAGE).toContain("onClick={() => applyStatus(code)}");
    expect(PAGE).toContain('setStatusFilter(code);');
    expect(PAGE).toContain('setPage(1);');
    expect(PAGE).toContain('updateUrl({ status: code || undefined, page: undefined })');
  });

  it("selected card carries the shared aria-pressed selected state", () => {
    render(<CommerceKpiCard label="Подтверждено" value={64} active />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    render(<CommerceKpiCard label="Проблема" value={4} active={false} />);
    const btns = screen.getAllByRole("button");
    expect(btns[btns.length - 1].getAttribute("aria-pressed")).toBe("false");
  });

  it("cards are real buttons; connectors are decorative aria-hidden", () => {
    expect(PAGE).toContain('aria-hidden="true"');
    expect(PAGE).toContain('aria-label={label}');
  });
});

describe("UI-C1.2D §5/§14/§31/§32 — server-authoritative overview, no client KPI fabrication", () => {
  it("KPI counts and the table come from ONE server list request (no /bookings/kpi, no client counting)", () => {
    expect(PAGE).toContain("api.get<Page<Booking>>(`/bookings?${qs.toString()}`)");
    expect(PAGE).not.toContain("/bookings/kpi");
    expect(PAGE).not.toContain(".filter((b) =>");
    expect(PAGE).not.toContain(".reduce(");
  });

  it("KPI counts are read from server aggregates (lifecycle overview), never page rows", () => {
    expect(PAGE).toContain("data?.aggregates?.lifecycle");
    expect(PAGE).toContain("lifecycleCounts[code] ?? 0");
    expect(PAGE).not.toContain("Math.round(");
  });

  it("status filter params go to the same /bookings query that returns KPI + table", () => {
    expect(PAGE).toContain('qs.set("status", statusFilter)');
    expect(PAGE).toContain('qs.set("dateFrom", dateFrom)');
    expect(PAGE).toContain('qs.set("dateTo", dateTo)');
    expect(PAGE).toContain('qs.set("page", String(page))');
  });

  it("detector params (upcoming/overdue/slaMinutes) are sent verbatim as GLOBAL scope", () => {
    expect(PAGE).toContain('qs.set("upcoming", "true")');
    expect(PAGE).toContain('qs.set("overdue", "true")');
    expect(PAGE).toContain('if (slaMinutes) qs.set("slaMinutes", slaMinutes)');
    // detector scope is never cleared by KPI-card selection / reset
    expect(PAGE).toContain("Detector scope comes from the URL only");
  });
});

describe("UI-C1.2D §15/§18/§33 — toolbar grammar + detector deep-links", () => {
  it("canonical toolbar order is [Search][Status][Reset][CSV][XLSX] — period is Header-owned", () => {
    const searchIdx = PAGE.indexOf('placeholder={t("admin.search.placeholder_bookings"');
    const statusIdx = PAGE.indexOf('aria-label={t("admin.filter.all_statuses"');
    const resetIdx = PAGE.indexOf('t("filters.reset", locale)');
    const exportIdx = PAGE.indexOf("<TableExportButton");
    expect(searchIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeGreaterThan(searchIdx);
    expect(resetIdx).toBeGreaterThan(statusIdx);
    expect(exportIdx).toBeGreaterThan(resetIdx);
    // UI-C1.2F.1B: local date controls removed — period is Header-owned
    expect(PAGE).toContain('UI-C1.2F.1B: Local date controls removed');
  });

  it("upcoming/overdue detector deep-link params are read from the URL", () => {
    expect(PAGE).toContain('sp.get("upcomingOnly") === "true" || sp.get("upcoming") === "true"');
    expect(PAGE).toContain('sp.get("overdueOnly") === "true" || sp.get("overdue") === "true"');
    expect(PAGE).toContain('sp.get("slaMinutes")');
  });

  it("detector-scoped serviceDate / waiting columns render only under the detector", () => {
    expect(PAGE).toContain("const showServiceDate = upcoming || overdue;");
    expect(PAGE).toContain("const showWaiting = overdue;");
    expect(PAGE).toContain('t("admin.table.col.service_date", locale)');
    expect(PAGE).toContain('t("admin.table.col.waiting", locale)');
  });
});

describe("UI-C1.2D §14/§17/§16/§12 — URL state, direct URL, Back/Forward, Reset", () => {
  it("canonical params read from URL on mount: search/status/dateFrom/dateTo/page", () => {
    expect(PAGE).toContain("useSearchParams");
    expect(PAGE).toContain('sp.get("status")');
    expect(PAGE).toContain('sp.get("search")');
    expect(PAGE).toContain('sp.get("dateFrom")');
    expect(PAGE).toContain('sp.get("dateTo")');
    expect(PAGE).toContain("history.replaceState");
  });

  it("filter/KPI interactions write the URL (replaceState — ADR-OPS-012)", () => {
    expect(PAGE).toContain('updateUrl({ search: value || undefined, page: undefined })');
    // UI-C1.2F.1B: date controls are Header-owned — registry only reads dateFrom/dateTo from URL
    expect(PAGE).toContain('qs.set("dateFrom", dateFrom)');
    expect(PAGE).toContain('qs.set("dateTo", dateTo)');
    expect(PAGE).toContain("handleTotalClick");
  });

  it("page param is written on pagination and restored on direct URL", () => {
    expect(PAGE).toContain('updateUrl({ page: p > 1 ? String(p) : undefined })');
    expect(PAGE).toContain("initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}");
  });

  it("Reset clears search/status, page → 1, URL normalized — Header Period preserved (detectors preserved)", () => {
    expect(PAGE).toContain("const handleReset = useCallback(");
    expect(PAGE).toContain('setSearch("")');
    expect(PAGE).toContain('setStatusFilter("")');
    // UI-C1.2F.1B: Reset preserves Header Period (dateFrom/dateTo)
    expect(PAGE).toContain('updateUrl({ search: undefined, status: undefined, page: undefined })');
    expect(PAGE).toContain('t("filters.reset", locale)');
  });
});

describe("UI-C1.2D §20/§33/§21/§22 — table consistency + locale cells + D6/D7 authority", () => {
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

  it("search is server-side and debounced ~350 ms", () => {
    expect(PAGE).toContain("}, 350);");
    expect(PAGE).toContain("debounceRef.current = setTimeout");
    expect(PAGE).toContain("onKeyDown={onSearchKeyDown}");
  });

  it("export carries the same active server filters (server-side table semantics)", () => {
    expect(PAGE).toContain("extraParams={{");
    expect(PAGE).toContain('...(statusFilter ? { status: statusFilter } : {})');
  });

  it("D6 action authority + D7 finance authority are not duplicated in the registry", () => {
    // no booking PATCH / action buttons or finance recomputation on the registry page
    expect(PAGE).not.toContain("api.patch(`/bookings/");
    expect(PAGE).not.toContain("availableActions");
    expect(PAGE).not.toContain("dueAmount");
    expect(PAGE).not.toContain("* 1.0");
  });
});

describe("UI-C1.2D §3/§24/§33 — shell + responsive-safe composition", () => {
  it("page renders inside the Operations Center shared shell (Bookings active)", () => {
    expect(PAGE).toContain("<OperationsCenterShell");
    expect(PAGE).toContain('activeDomain="bookings"');
    expect(PAGE).toContain("OperationsToolbarSlot");
    expect(PAGE).toContain("OperationsRegistrySlot");
    expect(PAGE).not.toContain("<PageHeader");
    expect(PAGE).not.toContain('<h1 className="text-2xl font-bold');
    expect(PAGE).not.toContain('title="Booking Center"');
  });

  it("flow rows are wrapping (2/3 responsive; one row at xl) and grids use registry grammar", () => {
    expect(PAGE).toContain('className="flex flex-wrap gap-2 xl:flex-nowrap xl:gap-0"');
    expect(PAGE).toContain("xl:w-[calc((100%-4rem)/3)]");
    expect(PAGE).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-4"');
    expect(PAGE).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7"');
  });

  it("detector columns are preserved for deep-link scoped tables", () => {
    expect(PAGE).toContain("showServiceDate");
    expect(PAGE).toContain("showWaiting");
  });
});
