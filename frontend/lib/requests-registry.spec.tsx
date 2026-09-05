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

const PAGE = read("app/app/requests/page.tsx");
// Shared sorting primitive that Requests columns delegate to (UI-C1.2F.1G §14 —
// no Requests-only sorting component may be invented).
const SORTABLE_HEADER = read("components/SortableHeader.tsx");
const LOCALES = ["ru", "az", "en"] as const;

/** The 12 ACTUAL canonical RequestStatus values (source of truth §3). */
const REQUEST_STATUSES = [
  "NEW",
  "CHECKING",
  "SUPPLIER_TIMEOUT",
  "PRICE_CHANGED",
  "CUSTOMER_ACCEPTED",
  "CONFIRMED",
  "CONVERTED",
  "REJECTED",
  "UNAVAILABLE",
  "EXPIRED",
  "CUSTOMER_PAYMENT_TIMEOUT",
  "CANCELLED_BY_CUSTOMER",
] as const;

/** Canonical RU labels bound in the UI-C1.2 visual-composition micro-closure. */
const EXPECTED_RU: Record<string, string> = {
  NEW: "Новые",
  CHECKING: "На проверке",
  SUPPLIER_TIMEOUT: "Таймаут поставщика",
  PRICE_CHANGED: "Ожидают решения",
  CUSTOMER_ACCEPTED: "Принята клиентом",
  CONFIRMED: "Подтверждены",
  CONVERTED: "Конвертированы",
  REJECTED: "Отклонены",
  UNAVAILABLE: "Недоступны",
  EXPIRED: "Истекли",
  CUSTOMER_PAYMENT_TIMEOUT: "Таймаут оплаты клиента",
  CANCELLED_BY_CUSTOMER: "Отменена клиентом",
};

describe("UI-C1.2B §4/§6/§34 — all 12 Request statuses have a visible KPI card", () => {
  it("page enumerates all 12 canonical RequestStatus values (no invented statuses)", () => {
    for (const code of REQUEST_STATUSES) {
      expect(PAGE).toContain(code);
    }
    // count the mapped card loop keys — 12 cards, one per canonical status
    const mapped = (PAGE.match(/REQUEST_LIFECYCLE_STATUSES\.map/g) ?? []).length;
    expect(mapped).toBeGreaterThanOrEqual(1);
  });

  it("each canonical status renders a CommerceKpiCard in the same card loop", () => {
    expect(PAGE).toContain("REQUEST_LIFECYCLE_STATUSES.map((code) =>");
    expect(PAGE).toContain("<CommerceKpiCard");
    expect(PAGE).toContain('active={selectedStatus === code}');
  });
});

describe("UI-C1.2B §5 — Total KPI canonical naming + size, no full-width hero", () => {
  it("Total label resolves to «Всего заявок» in RU and localized RU/AZ/EN", () => {
    expect(t("requests.kpi.total", "ru")).toBe("Всего заявок");
    expect(t("requests.kpi.total", "az")).toBeTruthy();
    expect(t("requests.kpi.total", "en")).toBe("Total requests");
  });

  it("Total card uses variant=total and is never full-width; label not «Все заявки»", () => {
    expect(PAGE).toContain('variant="total"');
    expect(PAGE).toContain('className="w-fit max-w-full"');
    expect(PAGE).not.toContain('t("requests.kpi.all"');
    expect(PAGE).not.toContain("w-full max-w-full");
  });

  it("Total card click clears the Request status filter and resets page to 1", () => {
    expect(PAGE).toContain('label={t("requests.kpi.total", locale)}');
    expect(PAGE).toContain('setStatusFilter("");');
    expect(PAGE).toContain("setPage(1);");
  });
});

describe("UI-C1.2B §6/§19/§24 — one canonical localized label per status (no raw enums)", () => {
  for (const code of REQUEST_STATUSES) {
    const key = `requests.kpi.${code.toLowerCase()}`;
    it(`${code}: requests.kpi.* label resolves in RU/AZ/EN and never returns the raw key`, () => {
      for (const loc of LOCALES) {
        const val = t(key, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("requests.kpi.");
        expect(val).not.toBe(code);
      }
    });
    it(`${code}: RU label is the binding micro-closure label (${EXPECTED_RU[code]})`, () => {
      expect(t(key, "ru")).toBe(EXPECTED_RU[code]);
    });
  }

  it("KPI cards, filter options and table badges share one label helper (requests.kpi.*)", () => {
    // one helper, used for cards, the filter select AND the table badge override
    const helperUses = (PAGE.match(/requestStatusLabel\(/g) ?? []).length;
    expect(helperUses).toBeGreaterThanOrEqual(3);
    expect(PAGE).toContain("requests.kpi.${code.toLowerCase()}");
    expect(PAGE).toContain("<StatusBadge status={r.status} label={requestStatusLabel(r.status, locale)} />");
    // no raw enum rendering in visible cells
    expect(PAGE).not.toContain("{r.status.toUpperCase()}");
  });

  it("table status header is localized (no hardcoded «Статус»)", () => {
    expect(t("admin.table.col.status", "ru")).toBe("Статус");
    expect(PAGE).toContain('t("admin.table.col.status", locale)');
  });
});

describe("UI-C1.2B §8/§9 — KPI click contract (server-side filter, page reset, URL write)", () => {
  it("status card click applies the canonical status filter and resets page to 1", () => {
    expect(PAGE).toContain('onClick={() => applyStatus(code)}');
    expect(PAGE).toContain('applyStatus(code)');
    expect(PAGE).toContain('setStatusFilter(code);');
    expect(PAGE).toContain("setPage(1);");
  });

  it("filter apply triggers a server-side registry fetch (no client-only filtering)", () => {
    // list request includes status + search server params
    expect(PAGE).toContain('params.set("status", statusFilter)');
    expect(PAGE).toContain('params.set("search", search)');
    expect(PAGE).toContain("api.get(`/requests?${params.toString()}`)");
    expect(PAGE).not.toContain(".filter((r) =>");
  });

  it("selected KPI card has a programmatic selected state (aria-pressed)", () => {
    render(<CommerceKpiCard label="NEW" value={3} active />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("card order follows the canonical enum order (not alphabetical)", () => {
    const arrIdx = PAGE.indexOf("REQUEST_LIFECYCLE_STATUSES = [");
    const arr = PAGE.slice(arrIdx, arrIdx + 1200);
    let prev = -1;
    for (const code of REQUEST_STATUSES) {
      const at = arr.indexOf(`"${code}"`);
      expect(at).toBeGreaterThan(prev);
      prev = at;
    }
  });
});

describe("UI-C1.2B §15/§17 — URL state + Reset", () => {
  it("canonical query subset implemented: search/status/page via useSearchParams", () => {
    expect(PAGE).toContain("useSearchParams");
    expect(PAGE).toContain('sp.get("status")');
    expect(PAGE).toContain('sp.get("search")');
    expect(PAGE).toContain('sp.get("page")');
    expect(PAGE).toContain("history.replaceState");
  });

  it("filter changes write the URL and reset page → 1", () => {
    expect(PAGE).toContain("updateUrl({ status: code || undefined, page: undefined })");
    expect(PAGE).toContain("updateUrl({ search: value || undefined, page: undefined })");
  });

  it("reload / direct URL / Back-Forward restore state from the URL on mount", () => {
    // state initializes from searchParams (single source of truth)
    expect(PAGE).toContain("initialStatus={sp.get(\"status\") ?? \"\"}");
    expect(PAGE).toContain("initialSearch={sp.get(\"search\") ?? \"\"}");
    expect(PAGE).toContain("initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}");
  });

  it("page is wrapped in Suspense (useSearchParams-compatible deep links)", () => {
    expect(PAGE).toContain("<Suspense");
    expect(PAGE).toContain("<RequestsWithParams />");
  });

  it("Reset clears search + status + sort, page → 1, URL normalized, server refresh", () => {
    expect(PAGE).toContain("const handleReset = useCallback(");
    expect(PAGE).toContain('setSearch("")');
    expect(PAGE).toContain('setStatusFilter("")');
    expect(PAGE).toContain('updateUrl({ search: undefined, status: undefined, sortBy: undefined, sortDirection: undefined, page: undefined })');
    expect(PAGE).toContain('t("filters.reset", locale)');
  });

  it("toolbar order is canonical: Search, then Reset, then CSV/XLSX (Status moved to table header)", () => {
    const searchIdx = PAGE.indexOf('placeholder={t("requests.search_placeholder"');
    const resetIdx = PAGE.indexOf('t("filters.reset", locale)');
    const exportIdx = PAGE.indexOf("<TableExportButton");
    expect(searchIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeGreaterThan(searchIdx);
    expect(exportIdx).toBeGreaterThan(resetIdx);
  });
});

describe("UI-C1.2B §11/§12/§35 — KPI/table scope honesty", () => {
  it("period/date control is NOT exposed as local toolbar input — period is Header-owned (UI-C1.2F.1B)", () => {
    // No local date input controls in the Requests toolbar
    expect(PAGE).not.toContain('type="date"');
    // dateFrom/dateTo ARE consumed from URL and sent to API (Header-owned)
    expect(PAGE).toContain('dateFrom');
    expect(PAGE).toContain('dateTo');
  });

  it("KPI values come from the server KPI endpoint, never from page rows", () => {
    expect(PAGE).toContain('/requests/kpi');
    // no aggregation over the current page rows to fabricate KPI counts
    expect(PAGE).not.toContain(".reduce(");
    expect(PAGE).not.toContain('kpi[statusFilter');
    expect(PAGE).not.toContain("Math.round(");
  });

  it("table and KPI both live under server-side Request query semantics (list scoped; KPI global overview)", () => {
    // Table: the server list endpoint is queried with the active status/search scope.
    expect(PAGE).toContain('params.set("page", String(page))');
    expect(PAGE).toContain('params.set("pageSize", String(pageSize))');
    // KPI: separate global overview endpoint — no separate global call re-presented
    // as filtered (the list and KPI calls are the only two Request data fetches).
  });
});

describe("UI-C1.2B §25 — loading / empty / error use shared Operations Center primitives", () => {
  it("loading state: shared skeleton while first data is loading; no fake KPI numbers", () => {
    expect(PAGE).toContain("OperationsLoadingState");
    expect(PAGE).toContain("loading && requests.length === 0 ?");
  });

  it("empty state distinguishes no-data vs no-results-for-active-filters", () => {
    expect(PAGE).toContain("filtersActive ? t(\"ops.empty_no_results\", locale) : t(\"requests.no_data\", locale)");
  });

  it("error state: shared user-safe alert + retry", () => {
    expect(PAGE).toContain("OperationsErrorState");
    expect(PAGE).toContain("onRetry={() => void loadData()}");
  });

  it("search is debounced (~350 ms) and typed-into without being blocked by loading", () => {
    expect(PAGE).toContain("}, 350);");
    expect(PAGE).toContain("debounceRef.current = setTimeout");
    expect(PAGE).toContain('onKeyDown={onSearchKeyDown}');
  });
});

describe("UI-C1.2B §26 — responsive-safe composition contract (testable classes)", () => {
  it("12 status cards form one wrapping registry grid shared with the other tabs", () => {
    expect(PAGE).toContain("grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6");
  });

  it("shell + shared slot primitives frame the page (no independent header)", () => {
    expect(PAGE).toContain("<OperationsCenterShell");
    expect(PAGE).toContain('activeDomain="requests"');
    expect(PAGE).toContain("OperationsToolbarSlot");
    expect(PAGE).toContain("OperationsRegistrySlot");
    expect(PAGE).not.toContain("<PageHeader");
    expect(PAGE).not.toContain('<h1 className="text-2xl font-bold');
  });

  it("locale-aware dates in the table (RU/AZ/EN BCP-47, no hardcoded ru-RU)", () => {
    expect(PAGE).toContain("LOCALE_TAGS[locale]");
    expect(PAGE).not.toContain('toLocaleDateString("ru-RU")');
  });
});

describe("UI-C1.2F.1G §5/§6 — Status removed from toolbar; Status header filter exists", () => {
  it("no native select (Status dropdown) remains in the Requests page toolbar", () => {
    expect(PAGE).not.toContain("<select");
  });

  it("Status filter renders inside the Status table header via the shared TableHeaderFilter", () => {
    expect(PAGE).toContain('import TableHeaderFilter from "@/components/TableHeaderFilter";');
    expect(PAGE).toContain('<TableHeaderFilter id="requests-status-filter"');
    expect(PAGE).toContain('options={statusFilterOptions} value={statusFilter} onChange={applyStatus}');
    expect(PAGE).toContain('ariaLabel={t("admin.filter.all_statuses", locale)}');
  });

  it("Status header filter options derive from the 12 canonical RequestStatus values", () => {
    expect(PAGE).toContain("const statusFilterOptions = REQUEST_LIFECYCLE_STATUSES.map((code) => ({");
    const blockIdx = PAGE.indexOf("const statusFilterOptions = REQUEST_LIFECYCLE_STATUSES.map");
    const block = PAGE.slice(blockIdx, blockIdx + 300);
    expect(block).toContain("value: code,");
    expect(block).toContain("label: requestStatusLabel(code, locale),");
    // no invented / legacy statuses — same source of truth as the KPI cards
    expect(block).not.toContain("CANCELLED");
    expect(block).not.toContain("PAID");
  });

  it("no duplication: exactly one Status filter control exists, and it lives in the header", () => {
    expect((PAGE.match(/requests-status-filter/g) ?? []).length).toBe(1);
    expect((PAGE.match(/<TableHeaderFilter/g) ?? []).length).toBe(1);
  });
});

describe("UI-C1.2F.1G §7/§8/§9 — KPI ↔ header filter share one state; one active KPI; static overview", () => {
  it("KPI card click and Status header filter route through the same applyStatus → one statusFilter state", () => {
    expect(PAGE).toContain("const applyStatus = useCallback(");
    expect(PAGE).toContain("onClick={() => applyStatus(code)}");
    expect(PAGE).toContain("onChange={applyStatus}");
    // no second, independent Status filter state was introduced
    expect(PAGE).not.toContain("statusHeaderFilter");
  });

  it("statusFilter is the single selected-KPI source: exactly one card can be active at a time", () => {
    expect(PAGE).toContain('const selectedStatus = statusFilter || "";');
    expect(PAGE).toContain("active={selectedStatus === code}");
    expect(PAGE).toContain("active={!selectedStatus}");
  });

  it("clearing status (Total card / header «Все») clears the URL param and deactivates status cards", () => {
    expect(PAGE).toContain('setStatusFilter("");');
    expect(PAGE).toContain("updateUrl({ status: undefined, page: undefined })");
  });

  it("KPI overview is STATIC under status filtering — the KPI fetch never carries status/search/sort", () => {
    const kpiStart = PAGE.indexOf("async function loadKpi()");
    const kpiEnd = PAGE.indexOf("const selectedStatus = statusFilter || \"\";");
    const kpiBody = PAGE.slice(kpiStart, kpiEnd);
    expect(kpiBody).toContain("/requests/kpi");
    expect(kpiBody).toContain('params.set("dateFrom", dateFrom)');
    expect(kpiBody).toContain('params.set("dateTo", dateTo)');
    expect(kpiBody).not.toContain('params.set("status"');
    expect(kpiBody).not.toContain('params.set("search"');
    expect(kpiBody).not.toContain('params.set("sortBy"');
    // only two Requests data fetches exist: scoped list + global-overview KPI
  });
});

describe("UI-C1.2F.1G §14/§15 — sortable headers use shared SortableHeader; Status sort + filter coexist", () => {
  const SORTABLE_FIELDS = [
    "referenceNumber",
    "displayedPrice",
    "confirmedPrice",
    "serviceDate",
    "status",
    "createdAt",
    "slaDeadline",
  ];

  it(`all ${SORTABLE_FIELDS.length} eligible columns use the shared SortableHeader`, () => {
    expect(PAGE).toContain('import SortableHeader, { type SortDirection } from "@/components/SortableHeader";');
    for (const field of SORTABLE_FIELDS) {
      expect(PAGE).toContain(`SortableHeader field="${field}"`);
    }
  });

  it("customer/product/supplier are NOT sortable and stay plain <th> (no backend-safe mapping)", () => {
    for (const field of ["customer", "product", "supplier"]) {
      expect(PAGE).not.toContain(`SortableHeader field="${field}"`);
    }
    const plainTh = PAGE.match(/<th className="px-4 py-2.5 font-medium">\{t\("requests\.(customer|product|supplier)"/g) ?? [];
    expect(plainTh.length).toBe(3);
  });

  it("Status column supports sort AND filter as two independent controls in the same header", () => {
    // sort target = the Status column label (sort button); filter target = the
    // dedicated filter button with its own accessible name (all_statuses).
    expect(PAGE).toContain('field="status" currentSort={currentSort} onSort={handleSort} filterSlot={<TableHeaderFilter');
    expect(PAGE).toContain('id="requests-status-filter"');
  });

  it("shared SortableHeader provides the canonical sort UX (toggle, aria-sort, button semantics)", () => {
    expect(SORTABLE_HEADER).toContain("type=\"button\"");
    expect(SORTABLE_HEADER).toContain('isActive && direction === "asc" ? "desc" : "asc"'); // click cycle asc↔desc
    expect(SORTABLE_HEADER).toContain("onSort(field, newDirection)");
    expect(SORTABLE_HEADER).toContain("aria-sort");
  });
});

describe("UI-C1.2F.1G §16/§22 — URL authority + server-side sorting", () => {
  it("sortBy/sortDirection are canonical Requests URL params (documented on the page)", () => {
    expect(PAGE).toContain("sortBy=&sortDirection=&page=");
    expect(PAGE).toContain('rawSortDirection = sp.get("sortDirection")');
  });

  it("sort click writes URL and resets page → 1; server list request carries the sort", () => {
    const hsStart = PAGE.indexOf("const handleSort = useCallback(");
    const hsEnd = PAGE.indexOf("const currentSort = sortBy");
    const hs = PAGE.slice(hsStart, hsEnd);
    expect(hs).toContain("setSortBy(field);");
    expect(hs).toContain("setSortDirection(direction);");
    expect(hs).toContain("setPage(1);");
    expect(hs).toContain("updateUrl({ sortBy: field, sortDirection: direction, page: undefined })");
  });

  it("status filter change resets page → 1 through the same server-scope path", () => {
    const asStart = PAGE.indexOf("const applyStatus = useCallback(");
    const asEnd = PAGE.indexOf("// Sort handler");
    const as = PAGE.slice(asStart, asEnd);
    expect(as).toContain("setStatusFilter(code);");
    expect(as).toContain("setPage(1);");
    expect(as).toContain("updateUrl({ status: code || undefined, page: undefined })");
  });

  it("sort is a server query param — no client-side row reordering exists", () => {
    expect(PAGE).toContain('if (sortBy) params.set("sortBy", sortBy);');
    expect(PAGE).toContain('if (sortBy) params.set("sortDirection", sortDirection);');
    expect(PAGE).not.toContain("requests.sort(");
    expect(PAGE).not.toContain(".filter((r) =>");
  });

  it("updateUrl touches only the keys passed — period and unrelated params are never cleared", () => {
    const uStart = PAGE.indexOf("const updateUrl = useCallback(");
    const uEnd = PAGE.indexOf("// Live search with debounce");
    const u = PAGE.slice(uStart, uEnd);
    expect(u).not.toContain('apply("dateFrom"');
    expect(u).not.toContain('apply("dateTo"');
    expect(u).not.toContain("dateFrom: undefined");
    expect(u).not.toContain("dateTo: undefined");
  });
});

describe("UI-C1.2F.1G §17/§28 — reload state derivation (URL → state on mount)", () => {
  it("status + sort state initialize from the URL (no useState(initialX) desync on reload/deep-link)", () => {
    expect(PAGE).toContain('initialStatus={sp.get("status") ?? ""}');
    expect(PAGE).toContain('initialSortBy={sp.get("sortBy") ?? ""}');
    expect(PAGE).toContain("initialSortDirection={");
    expect(PAGE).toContain('const [statusFilter, setStatusFilter] = useState(initialStatus || "");');
    expect(PAGE).toContain('const [sortBy, setSortBy] = useState(initialSortBy || "");');
    expect(PAGE).toContain('const [sortDirection, setSortDirection] = useState<SortDirection>((initialSortDirection as SortDirection) || "desc");');
  });

  it("only asc|desc is accepted as a deep-link sortDirection value", () => {
    expect(PAGE).toContain('rawSortDirection === "asc" || rawSortDirection === "desc" ? rawSortDirection : ""');
  });

  it("period state stays URL-synced when the Header Period changes the URL", () => {
    expect(PAGE).toContain("initialDateFrom={sp.get(\"dateFrom\") ?? \"\"}");
    expect(PAGE).toContain("initialDateTo={sp.get(\"dateTo\") ?? \"\"}");
    expect(PAGE).toContain("setDateFrom(initialDateFrom || \"\");");
    expect(PAGE).toContain("setDateTo(initialDateTo || \"\");");
  });
});

describe("UI-C1.2F.1G §18/§19 — Search/Status/Sort coexistence + Reset semantics", () => {
  it("Search + Status + Sort + Period are composed into ONE server list request", () => {
    const loadStart = PAGE.indexOf("async function loadData()");
    const loadEnd = PAGE.indexOf("// UI-C1.2F.1B: KPI with shared Header Period scope.");
    const body = PAGE.slice(loadStart, loadEnd);
    expect(body).toContain('params.set("status", statusFilter)');
    expect(body).toContain('params.set("search", search)');
    expect(body).toContain('if (sortBy) params.set("sortBy", sortBy);');
    expect(body).toContain('if (sortBy) params.set("sortDirection", sortDirection);');
    expect(body).toContain('if (dateFrom) params.set("dateFrom", dateFrom);');
    expect(body).toContain("api.get(`/requests?${params.toString()}`)");
  });

  it("Reset clears search + status + sort + page but PRESERVES Header Period", () => {
    const resetIdx = PAGE.indexOf("const handleReset = useCallback(");
    const resetBody = PAGE.slice(resetIdx, resetIdx + 700);
    expect(resetBody).toContain('setSearch("")');
    expect(resetBody).toContain('setStatusFilter("")');
    expect(resetBody).toContain('setSortBy("")');
    expect(resetBody).toContain('setSortDirection("desc")');
    expect(resetBody).toContain("setPage(1);");
    expect(resetBody).toContain("updateUrl({ search: undefined, status: undefined, sortBy: undefined, sortDirection: undefined, page: undefined })");
    expect(resetBody).not.toContain("setDateFrom(");
    expect(resetBody).not.toContain("setDateTo(");
  });
});

describe("UI-C1.2F.1G §21 — export scope (server-side, period+search+status, existing order kept)", () => {
  it("export forwards the active table scope but intentionally keeps existing sort behavior", () => {
    const expIdx = PAGE.indexOf("const exportParams = new URLSearchParams();");
    const expBody = PAGE.slice(expIdx, expIdx + 500);
    expect(expBody).toContain('exportParams.set("status", statusFilter)');
    expect(expBody).toContain('exportParams.set("search", search)');
    expect(expBody).toContain('exportParams.set("dateFrom", dateFrom)');
    expect(expBody).toContain('exportParams.set("dateTo", dateTo)');
    expect(expBody).not.toContain('exportParams.set("sortBy"');
    expect(expBody).not.toContain('exportParams.set("sortDirection"');
    expect(PAGE).toContain("const exportUrl = `/api/v1/requests/export?${exportParams.toString()}`;");
  });
});
