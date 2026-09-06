// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { t } from "./i18n";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

// Normalize line endings so multi-line substring assertions hold on Windows (CRLF) files.
const PAGE = read("app/app/payments/page.tsx").replace(/\r\n/g, "\n");
const LOCALES = ["ru", "az", "en"] as const;

/** Canonical PaymentStatus — exactly 6 (source: backend payments-registry). */
const PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "REFUNDED"] as const;
/** Canonical RefundStatus — exactly 4. */
const REFUND_STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "FAILED"] as const;

describe("UI-C1.2F §4 — canonical Payment/Refund enums + finance-owned DTO", () => {
  it("enumerates exactly 6 PaymentStatus and exactly 4 RefundStatus (no drift)", () => {
    for (const s of PAYMENT_STATUSES) expect(PAGE).toContain(`"${s}"`);
    for (const s of REFUND_STATUSES) expect(PAGE).toContain(`"${s}"`);
    expect(PAGE).toContain("const PAYMENT_STATUSES = [");
    expect(PAGE).toContain("const REFUND_STATUSES = [");
    expect(PAGE).not.toContain("PARTIALLY_");
  });

  it("status labels resolve via i18n (status.entity.*) in RU/AZ/EN — never raw enums", () => {
    for (const s of PAYMENT_STATUSES) {
      for (const loc of LOCALES) {
        const val = t(`status.entity.${s}`, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("status.entity.");
        expect(val).not.toBe(s);
      }
    }
    for (const s of REFUND_STATUSES) {
      for (const loc of LOCALES) {
        const val = t(`status.entity.${s}`, loc);
        expect(val).toBeTruthy();
        expect(val).not.toContain("status.entity.");
      }
    }
    expect(PAGE).toContain("const key = `status.entity.${code}`;");
  });

  it("finance-owned endpoint + aggregates contract preserved", () => {
    expect(PAGE).toContain("`/finance/payments?${qs.toString()}`");
    expect(PAGE).toContain("paymentStatus: Record<string, number>");
    expect(PAGE).toContain("refundStatus: Record<string, number>");
    expect(PAGE).toContain("currency: { currency: string; count: number; amount: string }[]");
  });
});

describe("UI-C1.2F §9/§57 — one active KPI dimension across paymentStatus XOR refundStatus XOR currencyCard", () => {
  it("paymentStatus selection clears refundStatus AND currencyCard", () => {
    expect(PAGE).toContain('setRefundStatusFilter("");');
    expect(PAGE).toContain('setCurrencyCardFilter("");');
    const region = PAGE.slice(PAGE.indexOf("const applyPaymentStatus"), PAGE.indexOf("const applyPaymentStatus") + 700);
    expect(region).toContain("refundStatus: undefined");
    expect(region).toContain("currencyCard: undefined");
    expect(region).toContain('setPaymentStatusFilter(code);');
  });

  it("refundStatus selection clears paymentStatus AND currencyCard", () => {
    const region = PAGE.slice(PAGE.indexOf("const applyRefundStatus"), PAGE.indexOf("const applyRefundStatus") + 700);
    expect(region).toContain('setRefundStatusFilter(code);');
    expect(region).toContain('setPaymentStatusFilter("");');
    expect(region).toContain('setCurrencyCardFilter("");');
    expect(region).toContain("paymentStatus: undefined");
    expect(region).toContain("currencyCard: undefined");
  });

  it("currencyCard selection clears paymentStatus AND refundStatus", () => {
    const region = PAGE.slice(PAGE.indexOf("const applyCurrencyCard"), PAGE.indexOf("const applyCurrencyCard") + 700);
    expect(region).toContain('setCurrencyCardFilter(code);');
    expect(region).toContain('setPaymentStatusFilter("");');
    expect(region).toContain('setRefundStatusFilter("");');
    expect(region).toContain("paymentStatus: undefined");
    expect(region).toContain("refundStatus: undefined");
  });

  it("Total clears ALL THREE table-only dimensions + page", () => {
    const region = PAGE.slice(PAGE.indexOf("const handleTotalClick"), PAGE.indexOf("const handleTotalClick") + 800);
    expect(region).toContain('setPaymentStatusFilter("");');
    expect(region).toContain('setRefundStatusFilter("");');
    expect(region).toContain('setCurrencyCardFilter("");');
    expect(region).toContain('setPage(1);');
    expect(region).toContain("paymentStatus: undefined");
    expect(region).toContain("refundStatus: undefined");
    expect(region).toContain("currencyCard: undefined");
  });

  it("specific pressed KPI count can never exceed 1 — every apply fn clears the other two dimensions first", () => {
    // the three apply callbacks are the only writers of the three filter states;
    // each clears both other dimensions, so at most one can be truthy afterwards
    expect(PAGE).toContain("setPaymentStatusFilter(code);\n    setRefundStatusFilter(\"\");\n    setCurrencyCardFilter(\"\");");
    expect(PAGE).toContain("setRefundStatusFilter(code);\n    setPaymentStatusFilter(\"\");\n    setCurrencyCardFilter(\"\");");
    expect(PAGE).toContain("setCurrencyCardFilter(code);\n    setPaymentStatusFilter(\"\");\n    setRefundStatusFilter(\"\");");
  });

  it("active KPI maps to single-dimension server query (table query never carries stale opposite dims)", () => {
    // load() only sets params that are truthy — exclusivity in state ⇒ exclusivity in query
    expect(PAGE).toContain('if (paymentStatusFilter) qs.set("paymentStatus", paymentStatusFilter);');
    expect(PAGE).toContain('if (refundStatusFilter) qs.set("refundStatus", refundStatusFilter);');
    expect(PAGE).toContain('if (currencyCardFilter) qs.set("currencyCard", currencyCardFilter);');
  });
});

describe("UI-C1.2F §10 — currency vs currencyCard distinction preserved", () => {
  it("currencyCard is the table-only card filter; no global `currency` param is invented or merged", () => {
    expect(PAGE).toContain("const [currencyCardFilter, setCurrencyCardFilter] = useState(initialCurrencyCard || \"\");");
    expect(PAGE).toContain('qs.set("currencyCard", currencyCardFilter)');
    // the page never writes a global currency query param
    expect(PAGE).not.toContain('qs.set("currency", currency');
    // documented contract preserved
    expect(PAGE).toContain("`currency` = global/base scope");
    expect(PAGE).toContain("`currencyCard` = table-only active-card scope");
  });
});

describe("UI-C1.2F.1F — Payments table-header filters (shared foundation)", () => {
  it("1/2/3. toolbar has NO PaymentStatus/RefundStatus/Currency selects — only global controls", () => {
    expect(PAGE).not.toContain("<select");
    expect(PAGE).not.toContain("admin.filter.all_statuses\", locale)}</option>");
    // toolbar grammar: search → reset → export
    const toolbarStart = PAGE.indexOf("<OperationsToolbarSlot>");
    const toolbarEnd = PAGE.indexOf("</OperationsToolbarSlot>");
    const toolbar = PAGE.slice(toolbarStart, toolbarEnd);
    expect(toolbar).toContain("onSearchChange");
    expect(toolbar).toContain('t("filters.reset", locale)');
    expect(toolbar).toContain("<TableExportButton");
    expect(toolbar).not.toContain("<select");
    expect(toolbar).not.toContain("payments-filter-"); // header filters are NOT toolbar controls
  });

  it("4. PaymentStatus header filter present in the sortable Статус column (shared TableHeaderFilter)", () => {
    expect(PAGE).toContain('import TableHeaderFilter, { type FilterOption } from "@/components/TableHeaderFilter";');
    expect(PAGE).toContain('id="payments-filter-status"');
    expect(PAGE).toContain("field=\"status\"");
    expect(PAGE).toContain("filterSlot={");
    expect(PAGE).toContain("options={buildPaymentFilterOptions(locale)}");
    expect(PAGE).toContain('ariaLabel={t("finance.filter.all_statuses", locale)}');
  });

  it("5. RefundStatus — NO invented header filter (audit-first: no refund column exists in the actual table)", () => {
    // the actual table has columns: code/createdAt/amount/currency/status/method/order/paidAt/providerRef
    // — no refund column, and the row DTO has no refundStatus field
    expect(PAGE).not.toContain("payments-filter-refund");
    expect(PAGE).toContain("NO invented header filter");
    // refundStatus remains a full KPI-card + URL + server-query dimension
    expect(PAGE).toContain("const applyRefundStatus = useCallback(");
    expect(PAGE).toContain('if (refundStatusFilter) qs.set("refundStatus", refundStatusFilter);');
    expect(PAGE).toContain("REFUND_STATUSES.map((code) =>");
  });

  it("6. Currency header filter present in the Валюта column (maps to currencyCard, not global currency)", () => {
    expect(PAGE).toContain('id="payments-filter-currency"');
    expect(PAGE).toContain('ariaLabel={t("finance.filter.all_currencies", locale)}');
    expect(PAGE).toContain("options={currencyFilterOptions(agg)}");
    expect(PAGE).toContain('value={currencyCardFilter || ""}');
    expect(PAGE).toContain("onChange={applyCurrencyCard}");
  });

  it("7/8/9. header filter and KPI click converge on ONE state per dimension (same URL param + server query)", () => {
    // header PaymentStatus → applyPaymentStatus; header Currency → applyCurrencyCard;
    // KPI cards use the exact same callbacks
    expect(PAGE).toContain("onChange={applyPaymentStatus}");
    expect(PAGE).toContain("onChange={applyCurrencyCard}");
    expect(PAGE).toContain("onClick={() => applyPaymentStatus(code)}");
    expect(PAGE).toContain("onClick={() => applyCurrencyCard(c.currency)}");
    expect(PAGE).toContain("onClick={() => applyRefundStatus(code)}");
    // no duplicate authority
    expect(PAGE).not.toContain("headerPaymentStatus");
    expect(PAGE).not.toContain("headerCurrencyCard");
  });

  it("10. KPI active state and header filter read the SAME single state source", () => {
    expect(PAGE).toContain("active={paymentStatusFilter === code}");
    expect(PAGE).toContain("active={refundStatusFilter === code}");
    expect(PAGE).toContain("active={currencyCardFilter === c.currency}");
    expect(PAGE).toContain('value={paymentStatusFilter || ""}');
    expect(PAGE).toContain('value={currencyCardFilter || ""}');
  });
});

describe("UI-C1.2F.1F — URL authority / page reset / coexistence / deep-link canonicalization", () => {
  it("filter change resets page → 1 and keeps search/period/sort untouched (independent keys)", () => {
    for (const fn of ["applyPaymentStatus", "applyRefundStatus", "applyCurrencyCard"]) {
      const region = PAGE.slice(PAGE.indexOf(`const ${fn}`), PAGE.indexOf(`const ${fn}`) + 700);
      expect(region).toContain("setPage(1);");
      expect(region).not.toContain("setSearch(");
      expect(region).not.toContain("setDateFrom");
      expect(region).not.toContain("setSortBy(");
      expect(region).not.toContain('updateUrl({ search:');
      expect(region).not.toContain("sortBy:");
    }
  });

  it("sort change never clears the active KPI dimension (sort is not a KPI dimension)", () => {
    const region = PAGE.slice(PAGE.indexOf("const handleSort"), PAGE.indexOf("const handleSort") + 400);
    expect(region).not.toContain("setPaymentStatusFilter");
    expect(region).not.toContain("setRefundStatusFilter");
    expect(region).not.toContain("setCurrencyCardFilter");
    expect(region).toContain('updateUrl({ sortBy: field, sortDirection: direction, page: undefined })');
  });

  it("sortBy/sortDirection convention + existing sortable columns preserved", () => {
    expect(PAGE).toContain('qs.set("sortBy", sortBy)');
    expect(PAGE).toContain('qs.set("sortDirection", sortDirection)');
    for (const f of ["code", "createdAt", "amount", "status", "paidAt"]) {
      expect(PAGE).toContain(`field="${f}"`);
    }
  });

  it("Total is not a full registry Reset — clears KPI dims only, preserves period/search/sort", () => {
    // window bounded to the Total handler itself (handleReset follows it in source)
    const start = PAGE.indexOf("const handleTotalClick");
    const region = PAGE.slice(start, start + 500);
    expect(region).toContain("paymentStatus: undefined");
    expect(region).not.toContain("search: undefined");
    expect(region).not.toContain("sortBy: undefined");
    expect(region).not.toContain("dateFrom: undefined");
    expect(region).not.toContain("dateTo: undefined");
    expect(region).toContain("}, [updateUrl]);");
  });

  it("registry Reset clears registry-local state (KPI dims + search + page) and PRESERVES Header Period", () => {
    const region = PAGE.slice(PAGE.indexOf("const handleReset"), PAGE.indexOf("const handleReset") + 900);
    expect(region).toContain("search: undefined");
    expect(region).toContain("paymentStatus: undefined");
    expect(region).toContain("refundStatus: undefined");
    expect(region).toContain("currencyCard: undefined");
    expect(region).not.toContain("dateFrom:");
    expect(region).not.toContain("dateTo:");
  });

  it("16. multi-dimension deep links are canonicalized with PURE render-time derivation (precedence paymentStatus > refundStatus > currencyCard)", () => {
    const region = PAGE.slice(PAGE.indexOf("function PaymentsWithParams"), PAGE.indexOf("export default"));
    expect(region).toContain("const multiDimensionConflict =");
    expect(region).toContain("(rawPaymentStatus ? 1 : 0) + (rawRefundStatus ? 1 : 0) + (rawCurrencyCard ? 1 : 0) > 1;");
    // canonical derivation happens before the return — no setState/router calls in the render body
    expect(region).toContain("const initialPaymentStatus = rawPaymentStatus;");
    expect(region).toContain("const initialRefundStatus = multiDimensionConflict");
    expect(region).toContain("const initialCurrencyCard = multiDimensionConflict");
    // between the canonical derivation and the normalization effect there must be
    // NO router/history call and NO state write (pure render phase)
    const winStart = region.indexOf("const initialPaymentStatus");
    const effectStart = region.indexOf("useEffect(() => {", winStart);
    const pureBlock = region.slice(winStart, effectStart);
    expect(pureBlock).not.toContain("router.replace(");
    expect(pureBlock).not.toContain("window.history");
    expect(pureBlock).not.toContain("setPaymentStatusFilter(");
    expect(pureBlock).not.toContain("setRefundStatusFilter(");
    expect(pureBlock).not.toContain("setCurrencyCardFilter(");
  });

  it("16b. URL normalization happens ONCE post-render via router.replace in useEffect (no render-phase mutation)", () => {
    const region = PAGE.slice(PAGE.indexOf("function PaymentsWithParams"), PAGE.indexOf("export default"));
    expect(region).toContain("useEffect(() => {");
    expect(region).toContain("params.delete(\"paymentStatus\");");
    expect(region).toContain("params.delete(\"refundStatus\");");
    expect(region).toContain("params.delete(\"currencyCard\");");
    expect(region).toContain("params.delete(\"page\");");
    expect(region).toContain("router.replace(qs ? `/app/payments?${qs}` : \"/app/payments\", { scroll: false });");
    expect(region).toContain("[multiDimensionConflict]);");
    expect(region).not.toContain("window.history.");
  });

  it("24. reload / deep-link derives the full single-dimension state from the URL", () => {
    expect(PAGE).toContain("initialPaymentStatus={initialPaymentStatus}");
    expect(PAGE).toContain("initialRefundStatus={initialRefundStatus}");
    expect(PAGE).toContain("initialCurrencyCard={initialCurrencyCard}");
    expect(PAGE).toContain('const [paymentStatusFilter, setPaymentStatusFilter] = useState(initialPaymentStatus || "");');
    expect(PAGE).toContain('const [refundStatusFilter, setRefundStatusFilter] = useState(initialRefundStatus || "");');
    expect(PAGE).toContain('const [currencyCardFilter, setCurrencyCardFilter] = useState(initialCurrencyCard || "");');
    expect(PAGE).toContain("sp.get(\"paymentStatus\") ?? \"\"");
    expect(PAGE).toContain("sp.get(\"refundStatus\") ?? \"\"");
    expect(PAGE).toContain("sp.get(\"currencyCard\") ?? \"\"");
  });

  it("25. popstate uses the accepted replace-semantics URL model (no unsynchronized header-only state)", () => {
    expect(PAGE).toContain("window.history.replaceState(null, \"\", qs ? `?${qs}` : window.location.pathname);");
    expect(PAGE).toContain("useSearchParams");
  });
});

describe("UI-C1.2F.1F — server-side filtering / static overview / export", () => {
  it("26. static KPI overview — no client-side row filtering or aggregate recount", () => {
    expect(PAGE).toContain("const agg = data?.aggregates;");
    expect(PAGE).toContain("agg?.paymentStatus?.[code] ?? 0");
    expect(PAGE).toContain("agg?.refundStatus?.[code] ?? 0");
    expect(PAGE).not.toContain(".filter((p) =>");
    expect(PAGE).not.toContain(".reduce(");
    expect(PAGE).not.toContain("data?.items?.length");
  });

  it("27. Header Period re-scopes the overview (aggregates recompute server-side) while table-only dims filter the table", () => {
    expect(PAGE).toContain('qs.set("dateFrom", dateFrom)');
    expect(PAGE).toContain('qs.set("dateTo", dateTo)');
    expect(PAGE).toContain("Sync dateFrom/dateTo when Header Period changes the URL");
  });

  it("28. static overview rule — selecting a table-only dim never re-scopes the aggregates", () => {
    // aggregates come from ONE server response computed on the overview scope;
    // the page renders agg.* unchanged under any KPI selection
    expect(PAGE).toContain("overviewTotal = agg?.total ?? data?.total ?? 0;");
    expect(PAGE).toContain("active={!hasCardFilter}");
  });

  it("29. export follows the active table scope (each table-only dim + period + search)", () => {
    expect(PAGE).toContain('exportUrl="/api/v1/finance/payments/export"');
    expect(PAGE).toContain('...(paymentStatusFilter ? { paymentStatus: paymentStatusFilter } : {})');
    expect(PAGE).toContain('...(refundStatusFilter ? { refundStatus: refundStatusFilter } : {})');
    expect(PAGE).toContain('...(currencyCardFilter ? { currencyCard: currencyCardFilter } : {})');
    expect(PAGE).toContain('...(dateFrom ? { dateFrom } : {})');
    expect(PAGE).toContain('...(dateTo ? { dateTo } : {})');
    expect(PAGE).toContain('...(search ? { search } : {})');
  });

  it("30. invalid enum/currency never silently falls back — table-only dims pass through verbatim to URL + server", () => {
    expect(PAGE).toContain('if (paymentStatusFilter) qs.set("paymentStatus", paymentStatusFilter);');
    expect(PAGE).not.toContain("PAYMENT_STATUSES.includes(paymentStatusFilter)");
    expect(PAGE).not.toContain("REFUND_STATUSES.includes(refundStatusFilter)");
    expect(PAGE).toContain('const [error, setError] = useState("");');
    expect(PAGE).toContain("<OperationsErrorState");
  });

  it("31. accessibility — header filters carry ids + accessible names; shared aria contract preserved; KPI aria-pressed retained", () => {
    expect(PAGE).toContain('id="payments-filter-status"');
    expect(PAGE).toContain('id="payments-filter-currency"');
    expect(PAGE).toContain('ariaLabel={t("finance.filter.all_statuses", locale)}');
    expect(PAGE).toContain('ariaLabel={t("finance.filter.all_currencies", locale)}');
    const shared = read("components/TableHeaderFilter.tsx");
    expect(shared).toContain("aria-expanded={open}");
    expect(shared).toContain("aria-haspopup=\"listbox\"");
    expect(shared).toContain("Escape");
    const kpi = read("components/commerce/CommerceKpiCard.tsx");
    expect(kpi).toContain("aria-pressed");
  });
});

describe("UI-C1.2F — shell / period / tab / table composition preserved", () => {
  it("renders inside the shared Operations Center shell (payments active), local date controls absent", () => {
    expect(PAGE).toContain("<OperationsCenterShell");
    expect(PAGE).toContain('activeDomain="payments"');
    expect(PAGE).toContain("OperationsToolbarSlot");
    expect(PAGE).toContain("OperationsRegistrySlot");
    expect(PAGE).not.toContain("type=\"date\"");
    expect(PAGE).toContain("UI-C1.2F.1B: Local date controls removed");
  });

  it("actual table column model — code/createdAt/amount/currency/status/method/order/paidAt/providerRef", () => {
    for (const key of [
      "payments.col.code", "payments.col.created", "payments.col.amount", "payments.col.currency",
      "payments.col.status", "payments.col.method", "payments.col.order", "payments.col.paid_at",
      "payments.col.provider_ref",
    ]) {
      expect(PAGE).toContain(`t("${key}", locale)`);
    }
    expect(PAGE).not.toContain("payments.col.refund");
  });

  it("payments group order preserved: Total → PaymentStatus → Currencies → RefundStatus", () => {
    const totalIdx = PAGE.indexOf("payments.kpi.total");
    const psIdx = PAGE.indexOf("payments.group.payment_statuses");
    const curIdx = PAGE.indexOf("payments.group.currencies");
    const rsIdx = PAGE.indexOf("payments.group.refund_statuses");
    expect(totalIdx).toBeGreaterThan(-1);
    expect(psIdx).toBeGreaterThan(totalIdx);
    expect(curIdx).toBeGreaterThan(psIdx);
    expect(rsIdx).toBeGreaterThan(curIdx);
  });

  it("table-only KPI cards keep server overview values; nothing invented for empty aggregates", () => {
    expect(PAGE).toContain("agg?.currency && agg.currency.length > 0 && (");
    expect(PAGE).toContain("value={`${c.count} · ${fmtMoney(c.amount, c.currency, locale)}`}");
  });
});
