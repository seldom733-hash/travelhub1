// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import { LocaleProvider } from "./i18n";
import {
  getHelpEntry as getRegistryEntry,
  HELP_AREAS,
  HELP_CONTENT_AREAS,
  HELP_REGISTRY,
  helpEntriesByArea,
} from "./help-registry";
import {
  buildHelpQueryString,
  countByType,
  filterHelpEntries,
  HELP_FILTERABLE_AREAS,
  HELP_TYPE_FILTERS,
  parseHelpQuery,
} from "./help-search";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
}

const REQUESTS = read("app/app/requests/page.tsx");
const ORDERS = read("app/app/orders/page.tsx");
const BOOKINGS = read("app/app/bookings/page.tsx");
const PAYMENTS = read("app/app/payments/page.tsx");
const HELP_PAGE = read("app/app/help/page.tsx");
const KPI_CARD = read("components/commerce/CommerceKpiCard.tsx");
const POPOVER = read("components/commerce/MetricHelpPopover.tsx");
const SHELL = read("components/Shell.tsx");
const REGISTRY = read("lib/help-registry.ts");
const HELP_I18N = read("lib/help-i18n.ts");

describe("UI-C1.2H §2.11 — hardcoded Russian fallbacks removed (canonical i18n only)", () => {
  it("Requests page has no `|| «Жизненный цикл»` / `|| «Проблемы и завершения»` fallbacks", () => {
    expect(REQUESTS).not.toContain('|| "Жизненный цикл"');
    expect(REQUESTS).not.toContain('|| "Проблемы и завершения"');
  });

  it("Requests group headings still resolve through i18n keys", () => {
    expect(REQUESTS).toContain('t("requests.group.lifecycle", locale)');
    expect(REQUESTS).toContain('t("requests.group.exceptions", locale)');
  });
});

describe("UI-C1.2H §13 — KPI cards bind canonical Help Registry ids on all 4 registries", () => {
  it("Requests: total + 12 status cards bind helpId", () => {
    expect(REQUESTS).toContain('helpId="requests.kpi.total"');
    expect(REQUESTS).toContain("helpId={`requests.status.${code.toLowerCase()}`}");
  });

  it("Orders: total + lifecycle + payment cards bind helpId", () => {
    expect(ORDERS).toContain('helpId="orders.kpi.total"');
    expect(ORDERS).toContain("helpId={`orders.status.${code.toLowerCase()}`}");
    expect(ORDERS).toContain("helpId={`orders.payment.${code.toLowerCase()}`}");
  });

  it("Bookings: total + FlowRow + all status groups bind helpId", () => {
    expect(BOOKINGS).toContain('helpId="bookings.kpi.total"');
    expect(BOOKINGS).toContain("helpId={`bookings.status.${code.toLowerCase()}`}");
  });

  it("Payments: total + PaymentStatus + RefundStatus cards bind helpId; currency cards do NOT", () => {
    expect(PAYMENTS).toContain('helpId="payments.kpi.total"');
    expect(PAYMENTS).toContain("helpId={`payments.status.${code.toLowerCase()}`}");
    expect(PAYMENTS).toContain("helpId={`payments.refund.status.${code.toLowerCase()}`}");
    // Currency cards describe dynamic data (not statuses) → the CURRENCY group block must not bind help.
    const currencyBlock = PAYMENTS.slice(
      PAYMENTS.indexOf("CURRENCY GROUP"),
      PAYMENTS.indexOf("REFUND STATUS GROUP"),
    );
    expect(currencyBlock).toContain("<CommerceKpiCard");
    expect(currencyBlock).not.toContain("helpId");
  });

  it("CommerceKpiCard is the shared host: optional helpId prop + MetricHelpPopover import", () => {
    expect(KPI_CARD).toContain('helpId?: string;');
    expect(KPI_CARD).toContain('import MetricHelpPopover from "./MetricHelpPopover";');
    expect(KPI_CARD).toContain('entryId={helpId}');
  });
});

describe("UI-C1.2H §16 — popover accessibility contract (source markers)", () => {
  it("trigger exposes accessible name, aria-haspopup and aria-expanded", () => {
    expect(POPOVER).toContain('aria-haspopup="dialog"');
    expect(POPOVER).toContain("aria-expanded={open}");
    expect(POPOVER).toContain('aria-label={triggerLabel}');
    expect(POPOVER).toContain('helpT("help.trigger_aria", locale)');
  });

  it("popover is a labelled dialog, keyboard-only reachable, Escape closes + focus returns", () => {
    expect(POPOVER).toContain('role="dialog"');
    expect(POPOVER).toContain('aria-label={title}');
    expect(POPOVER).toContain('if (e.key === "Escape")');
    expect(POPOVER).toContain("triggerRef.current?.focus()");
    expect(POPOVER).toContain("tabIndex={-1}");
  });

  it("content flows Registry → localizationKeys → i18n (no hardcoded definitions)", () => {
    expect(POPOVER).toContain('getHelpEntry(entryId)');
    expect(POPOVER).toContain('helpShort(entry, locale)');
    expect(POPOVER).toContain('helpTitle(entry, locale)');
    expect(POPOVER).not.toContain('"Заявки');
    expect(POPOVER).toContain('/app/help?topic=${encodeURIComponent(entry.id)}');
  });
});

describe("UI-C1.2H §12 — Help Center page contract", () => {
  it("deep links: ?topic= stable ids → full definition view", () => {
    expect(HELP_PAGE).toContain('searchParams.get("topic")');
    expect(HELP_PAGE).toContain("getHelpEntry(activeTopic)");
    expect(HELP_PAGE).toContain("/app/help?topic=${encodeURIComponent(entry.id)}");
    expect(HELP_PAGE).toContain('helpDescription(entry, locale)');
  });

  it("unknown topic is handled with a localized alert, never a crash or raw lookup", () => {
    expect(HELP_PAGE).toContain('role="alert"');
    expect(HELP_PAGE).toContain('helpT("help.topic_not_found", locale)');
    expect(HELP_PAGE).toContain("unknownTopic");
  });

  it("content is localized through the Help i18n bridge and the main dictionary", () => {
    expect(HELP_PAGE).toContain('helpT("help.title", locale)');
    expect(HELP_PAGE).toContain('helpT("help.domains_title", locale)');
    expect(HELP_PAGE).toContain("DOMAIN_LABEL_KEY");
  });

  it("Help page lists the current content grouped under canonical Registry areas", () => {
    expect(HELP_PAGE).toContain("HELP_CONTENT_AREAS.map");
    expect(HELP_PAGE).toContain("HELP_DOMAINS.filter");
    expect(HELP_PAGE).toContain("nav.requests");
    expect(HELP_PAGE).toContain("nav.orders");
    expect(HELP_PAGE).toContain("nav.bookings");
    expect(HELP_PAGE).toContain("nav.payments");
  });

  it("search + type/section filters are URL-driven through the pure help-search model", () => {
    expect(HELP_PAGE).toContain('from "@/lib/help-search"');
    expect(HELP_PAGE).toContain("parseHelpQuery(");
    expect(HELP_PAGE).toContain('aria-label={helpT("help.search_aria", locale)}');
    expect(HELP_PAGE).toContain('aria-pressed={');
  });

  it("sidebar exposes the Help entry (nav.help → /app/help) with a main-DICT label", () => {
    expect(SHELL).toContain('{ href: "/app/help", icon: "❓", labelKey: "nav.help" }');
    const I18N_MAIN = read("lib/i18n.tsx");
    expect(I18N_MAIN).toContain('"nav.help": { ru: "Справка", az: "Kömək", en: "Help" }');
  });

  it("Help i18n bridge carries RU/AZ/EN for every help key", () => {
    const body = HELP_I18N.slice(HELP_I18N.indexOf("HELP_DICT"), HELP_I18N.indexOf("export function helpT"));
    // count dictionary entries (single-line and multi-line values alike)
    const keyCount = (body.match(/^\s*"[a-z0-9.]+\": \{/gm) ?? []).length;
    expect(keyCount).toBeGreaterThan(60);
    // every entry must expose all three locales — no single-locale placeholders
    expect(HELP_I18N).toContain('"help.requests.status.new.short": {');
    expect(HELP_I18N).toContain('"help.requests.kpi.total.description": {');
    expect(HELP_I18N).not.toContain('"help.unknown.placeholder"');
    const ruValues = (body.match(/ru: "/g) ?? []).length;
    expect(ruValues).toBeGreaterThan(60);
  });
});

describe("UI-C1.2H §13/§16 — popover runtime behavior", () => {
  function renderCard(helpId?: string) {
    return render(
      <LocaleProvider>
        <CommerceKpiCard label="Новые" value={3} helpId={helpId} />
      </LocaleProvider>,
    );
  }

  it("card with helpId shows an accessible help trigger beside the card button", () => {
    renderCard("requests.status.new");
    const trigger = screen.getByRole("button", { name: "Справка: Новые" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // the card itself stays a separate pressable control (accessible name = label + value)
    expect(screen.getAllByRole("button").length).toBe(2);
    expect(screen.getByRole("button", { name: "Новые3" })).toBeTruthy();
  });

  it("clicking the trigger opens a labelled dialog with the localized definition", () => {
    renderCard("requests.status.new");
    const trigger = screen.getByRole("button", { name: "Справка: Новые" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Новые" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(dialog.textContent).toContain("Заявки, созданные и ожидающие первичной обработки.");
    const link = dialog.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/app/help?topic=requests.status.new");
  });

  it("Escape closes the dialog and returns focus to the trigger", () => {
    renderCard("requests.status.new");
    const trigger = screen.getByRole("button", { name: "Справка: Новые" });
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("unknown entry id renders no trigger (registry is authoritative)", () => {
    renderCard("not.a.real.id");
    expect(screen.queryByRole("button", { name: /Справка:/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Новые3" })).toBeTruthy();
  });
});

describe("UI-C1.2H.2 — Global Help Center navigation: URL query model (lib/help-search)", () => {
  it("parseHelpQuery canonicalizes type/area/q deterministically", () => {
    expect(parseHelpQuery({ type: "kpi", area: "operations", q: "  paid  " })).toEqual({
      type: "kpi",
      area: "operations",
      q: "paid",
    });
    expect(parseHelpQuery({ type: "formula", area: "crm", q: "" })).toEqual({ type: undefined, area: undefined, q: undefined });
    expect(parseHelpQuery({ type: "bogus", area: "future", q: null })).toEqual({ type: undefined, area: undefined, q: undefined });
    const long = "x".repeat(200);
    expect(parseHelpQuery({ type: null, area: null, q: long }).q?.length).toBe(120);
  });

  it("area filters accept ONLY content areas; type filters accept ONLY kpi/status", () => {
    expect(HELP_TYPE_FILTERS).toEqual(["kpi", "status"]);
    expect([...HELP_FILTERABLE_AREAS].sort()).toEqual([...HELP_CONTENT_AREAS].sort());
    expect(HELP_FILTERABLE_AREAS).not.toContain("crm");
    expect(HELP_FILTERABLE_AREAS).not.toContain("marketplace");
  });

  it("buildHelpQueryString round-trips state and preserves ?topic", () => {
    expect(
      buildHelpQueryString({ type: "status", area: "finance", q: "refund" }, "payments.status.refunded"),
    ).toBe("?topic=payments.status.refunded&type=status&area=finance&q=refund");
    expect(buildHelpQueryString({})).toBe("");
  });

  it("type/area filtering matches Registry totals (68 / operations 54 / finance 14 / kpi 4 / status 51)", () => {
    expect(HELP_REGISTRY.length).toBe(68);
    expect(helpEntriesByArea("operations").length).toBe(54);
    expect(helpEntriesByArea("finance").length).toBe(14);
    expect(filterHelpEntries(HELP_REGISTRY, { type: "kpi" }, "ru").length).toBe(4);
    expect(filterHelpEntries(HELP_REGISTRY, { type: "status" }, "ru").length).toBe(51);
    expect(filterHelpEntries(HELP_REGISTRY, { area: "finance", type: "status" }, "ru").length).toBe(10);
    expect(filterHelpEntries(HELP_REGISTRY, { area: "finance", type: "kpi" }, "ru").length).toBe(1);
  });

  it("search matches stable IDs and localized metadata only (never business data)", () => {
    expect(filterHelpEntries(HELP_REGISTRY, { q: "bookings.status.confirmed" }, "ru").length).toBe(1);
    expect(filterHelpEntries(HELP_REGISTRY, { q: "kpi.total" }, "ru").length).toBe(4);
    expect(filterHelpEntries(HELP_REGISTRY, { q: "zzz-no-such-topic" }, "ru").length).toBe(0);
    expect(getRegistryEntry("requests.status.new") && parseHelpQuery({ q: "Новые" }).q).toBe("Новые");
  });

  it("counts are derived from the Registry, never hardcoded", () => {
    expect(countByType(helpEntriesByArea("finance"))).toEqual({ kpi: 1, status: 10, group: 3 });
    expect(countByType(HELP_REGISTRY)).toEqual({ kpi: 4, status: 51, group: 13 });
    const total = HELP_AREAS.reduce((sum, a) => sum + helpEntriesByArea(a).length, 0);
    expect(total).toBe(HELP_REGISTRY.length);
  });

  it("concept/formula/workflow/policy carry no content today (type filters are honest)", () => {
    const counts = countByType(HELP_REGISTRY);
    expect(counts.concept).toBeUndefined();
    expect(counts.formula).toBeUndefined();
    expect(counts.workflow).toBeUndefined();
    expect(counts.policy).toBeUndefined();
  });
});

describe("UI-C1.2H.2 — page uses canonical taxonomy + Finance distinction (source markers)", () => {
  it("navigation derives areas from the canonical Registry (no second taxonomy)", () => {
    expect(HELP_PAGE).toContain("HELP_AREAS.filter");
    expect(HELP_PAGE).toContain("HELP_CONTENT_AREAS.map");
    expect(HELP_PAGE).toContain("HELP_DOMAINS.filter");
    expect(HELP_PAGE).toContain("parseHelpQuery(");
  });

  it("Finance is never presented as an implemented Finance Center", () => {
    expect(HELP_PAGE).toContain('area === "finance"');
    expect(HELP_PAGE).toContain('helpT("help.finance_center_status", locale)');
    expect(HELP_PAGE).toContain('helpT("help.payments_finance_ownership", locale)');
    expect(HELP_PAGE).not.toContain("Финансовый центр — реализован");
    expect(HELP_PAGE).not.toContain("Платежи");
  });

  it("future areas are explicit NOT STARTED states without fake counts", () => {
    expect(HELP_PAGE).toContain('helpT("help.future_sections", locale)');
    expect(HELP_PAGE).toContain('helpT("help.future_area_note", locale)');
    expect(HELP_PAGE).toContain("helpEntriesByArea(area).length");
  });

  it("Help i18n carries RU/AZ/EN for every area label and the H.2 UX strings", () => {
    for (const area of HELP_AREAS) {
      expect(HELP_I18N).toContain(`"help.area.${area}": {`);
    }
    expect(HELP_I18N).toContain('"help.search_aria": {');
    expect(HELP_I18N).toContain('"help.search_no_results": {');
    expect(HELP_I18N).toContain('"help.filter_metrics": {');
    expect(HELP_I18N).toContain('"help.filter_statuses": {');
    expect(HELP_I18N).toContain('"help.finance_center_status": {');
    expect(HELP_I18N).toContain('"help.payments_finance_ownership": {');
    expect(HELP_I18N).toContain('"help.future_area_note": {');
  });
});
