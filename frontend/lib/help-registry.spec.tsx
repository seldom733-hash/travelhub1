// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  ALL_HELP_IDS,
  getHelpEntry,
  helpAreaOf,
  helpDescription,
  helpEntriesByArea,
  helpEntriesByDomain,
  helpShort,
  helpTitle,
  helpWorkspaceOf,
  HELP_AREAS,
  HELP_AREA_BY_DOMAIN,
  HELP_CONTENT_AREAS,
  HELP_ENTRY_TYPES,
  HELP_REGISTRY,
  HELP_STATUS_ENTRIES,
} from "./help-registry";
import { HELP_DICT, helpT } from "./help-i18n";
import { t } from "./i18n";

const LOCALES = ["ru", "az", "en"] as const;

/** Canonical status universes (must match registry pages, UI-C1.2G acceptance). */
const REQUESTS_STATUSES = [
  "NEW", "CHECKING", "PRICE_CHANGED", "CUSTOMER_ACCEPTED", "CONFIRMED", "CONVERTED",
  "SUPPLIER_TIMEOUT", "CUSTOMER_PAYMENT_TIMEOUT", "REJECTED", "UNAVAILABLE", "EXPIRED", "CANCELLED_BY_CUSTOMER",
] as const;
const ORDERS_STATUSES = [
  "NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING", "SENT_TO_BOOKING",
  "PARTIALLY_FULFILLED", "FULFILLED", "READY_TO_CLOSE", "CLOSED", "CANCELLED", "PROBLEM", "SUSPENDED",
] as const;
const ORDER_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"] as const;
const BOOKINGS_STATUSES = [
  "NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION", "CONFIRMED",
  "IN_SERVICE", "COMPLETED", "NEEDS_CLARIFICATION", "SUPPLIER_REJECTED", "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED", "CANCELLED", "PROBLEM",
] as const;
const PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "REFUNDED"] as const;
const REFUND_STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "FAILED"] as const;

const byDomain = (domain: string) => HELP_REGISTRY.filter((e) => e.domain === domain);

describe("UI-C1.2H §5/§6 — canonical Help Registry inventory", () => {
  it("Requests: 12 canonical statuses + total KPI + lifecycle/exceptions groups", () => {
    const req = byDomain("requests");
    expect(req.filter((e) => e.type === "status").length).toBe(12);
    expect(req.some((e) => e.id === "requests.kpi.total" && e.type === "kpi")).toBe(true);
    expect(req.filter((e) => e.type === "group").map((e) => e.id).sort()).toEqual([
      "requests.group.exceptions",
      "requests.group.lifecycle",
    ]);
    for (const code of REQUESTS_STATUSES) {
      expect(getHelpEntry(`requests.status.${code.toLowerCase()}`), `missing ${code}`).toBeDefined();
    }
  });

  it("Orders: 12 OrderStatus + 4 OrderPaymentStatus + total KPI + 4 groups", () => {
    const ord = byDomain("orders");
    const statusIds = ord.filter((e) => e.type === "status").map((e) => e.id);
    expect(statusIds.length).toBe(16);
    expect(ord.some((e) => e.id === "orders.kpi.total" && e.type === "kpi")).toBe(true);
    for (const code of ORDERS_STATUSES) {
      expect(statusIds).toContain(`orders.status.${code.toLowerCase()}`);
    }
    for (const code of ORDER_PAYMENT_STATUSES) {
      expect(statusIds).toContain(`orders.payment.${code.toLowerCase()}`);
    }
    expect(ord.filter((e) => e.type === "group").length).toBe(4);
  });

  it("Bookings: 13 canonical statuses + total KPI + 4 groups", () => {
    const bkg = byDomain("bookings");
    expect(bkg.filter((e) => e.type === "status").length).toBe(13);
    expect(bkg.some((e) => e.id === "bookings.kpi.total" && e.type === "kpi")).toBe(true);
    for (const code of BOOKINGS_STATUSES) {
      expect(getHelpEntry(`bookings.status.${code.toLowerCase()}`), `missing ${code}`).toBeDefined();
    }
    expect(bkg.filter((e) => e.type === "group").length).toBe(4);
  });

  it("Payments: 6 PaymentStatus + 4 RefundStatus (never mixed) + total KPI + 3 groups", () => {
    const pay = byDomain("payments");
    expect(pay.filter((e) => e.type === "status").length).toBe(10);
    for (const code of PAYMENT_STATUSES) {
      expect(getHelpEntry(`payments.status.${code.toLowerCase()}`), `missing ${code}`).toBeDefined();
    }
    for (const code of REFUND_STATUSES) {
      expect(getHelpEntry(`payments.refund.status.${code.toLowerCase()}`), `missing ${code}`).toBeDefined();
    }
    const paymentGroup = (id: string) => getHelpEntry(id)?.group;
    expect(paymentGroup("payments.status.captured")).toBe("payments.group.payment_statuses");
    expect(paymentGroup("payments.refund.status.requested")).toBe("payments.group.refund_statuses");
    expect(pay.filter((e) => e.type === "group").length).toBe(3);
  });

  it("PaymentStatus ≠ RefundStatus — stable IDs are disjoint and grouped separately", () => {
    const pay = byDomain("payments");
    const statusIds = new Set(pay.filter((e) => e.type === "status").map((e) => e.id));
    const paymentIds = PAYMENT_STATUSES.map((c) => `payments.status.${c.toLowerCase()}`);
    const refundIds = REFUND_STATUSES.map((c) => `payments.refund.status.${c.toLowerCase()}`);
    for (const id of paymentIds) expect(refundIds).not.toContain(id);
    expect(statusIds.size).toBe(paymentIds.length + refundIds.length);
  });

  it("no invented statuses: PARTIALLY_CONFIRMED and CASH do not exist anywhere in the registry", () => {
    expect(ALL_HELP_IDS.some((id) => id.includes("partially_confirmed"))).toBe(false);
    expect(ALL_HELP_IDS.some((id) => id.toLowerCase().includes("cash"))).toBe(false);
    expect(HELP_REGISTRY.some((e) => e.id === "bookings.status.partially_confirmed")).toBe(false);
  });
});

describe("UI-C1.2H §5.1/§7/§11 — entry contract quality", () => {
  it("stable IDs are lowercase {domain}.{metric-or-status}, never localized", () => {
    const re = /^(requests|orders|bookings|payments)\.[a-z0-9_.]+$/;
    for (const id of ALL_HELP_IDS) {
      expect(id, id).toMatch(re);
      expect(id).toBe(id.toLowerCase());
      expect(id).not.toContain(" ");
    }
  });

  it("every entry carries required metadata + a 3-key localization mapping", () => {
    for (const e of HELP_REGISTRY) {
      expect(e.id).toBeTruthy();
      expect(e.type).toMatch(/^(kpi|status|group)$/);
      expect(e.domain).toMatch(/^(requests|orders|bookings|payments)$/);
      expect(e.source).toBeTruthy();
      expect(e.scope).toMatch(/^(global|table)$/);
      expect(e.businessDefinition).toBeTruthy();
      expect(e.contractVersion).toBeTruthy();
      expect(e.localizationKeys.title).toBeTruthy();
      expect(e.localizationKeys.short).toBeTruthy();
      expect(e.localizationKeys.description).toBeTruthy();
    }
  });

  it("every status entry points to a real group entry of the same domain; groups are not statuses", () => {
    const groupIds = new Set(HELP_REGISTRY.filter((e) => e.type === "group").map((e) => e.id));
    for (const e of HELP_STATUS_ENTRIES) {
      expect(e.group, `${e.id} has a group`).toBeTruthy();
      const group = getHelpEntry(e.group as string);
      expect(group, `${e.id} → ${e.group}`).toBeDefined();
      expect(group!.type).toBe("group");
      expect(group!.domain).toBe(e.domain);
    }
    for (const g of HELP_REGISTRY.filter((e) => e.type === "group")) {
      expect(groupIds.has(g.id)).toBe(true);
      expect(g.group).toBeUndefined();
    }
  });

  it("statuses are table-scope filters; kpi totals are global-scope (static overview rule)", () => {
    for (const e of HELP_STATUS_ENTRIES) expect(e.scope).toBe("table");
    for (const e of HELP_REGISTRY.filter((x) => x.type === "kpi")) {
      expect(e.scope).toBe("global");
      expect(e.period).toBe("global");
      expect(e.formula).toBeTruthy();
    }
  });
});

describe("UI-C1.2H §14/§15 — localized content resolves RU/AZ/EN (no raw keys, no raw enums as titles)", () => {
  it("title/short/description resolve for every entry in all three locales — never the raw key", () => {
    for (const e of HELP_REGISTRY) {
      for (const loc of LOCALES) {
        const title = helpTitle(e, loc);
        const short = helpShort(e, loc);
        const desc = helpDescription(e, loc);
        expect(title, `${e.id} title ${loc}`).toBeTruthy();
        expect(short, `${e.id} short ${loc}`).toBeTruthy();
        expect(desc, `${e.id} description ${loc}`).toBeTruthy();
        expect(title, `${e.id} title raw ${loc}`).not.toBe(e.localizationKeys.title);
        expect(short, `${e.id} short raw ${loc}`).not.toBe(e.localizationKeys.short);
        expect(desc, `${e.id} desc raw ${loc}`).not.toBe(e.localizationKeys.description);
      }
    }
  });

  it("every short/description key exists in HELP_DICT (explicit mapping, no silent fallback)", () => {
    for (const e of HELP_REGISTRY) {
      expect(HELP_DICT[e.localizationKeys.short], `${e.id} short key`).toBeTruthy();
      expect(HELP_DICT[e.localizationKeys.description], `${e.id} description key`).toBeTruthy();
    }
  });

  it("title keys bind the SAME labels the registry pages display", () => {
    // Requests KPI cards → requests.kpi.* (page helper requestStatusLabel)
    expect(getHelpEntry("requests.status.new")!.localizationKeys.title).toBe("requests.kpi.new");
    expect(getHelpEntry("requests.status.cancelled_by_customer")!.localizationKeys.title).toBe(
      "requests.kpi.cancelled_by_customer",
    );
    // Orders lifecycle → order.status.* ; payment → order.payment.*
    expect(getHelpEntry("orders.status.in_processing")!.localizationKeys.title).toBe("order.status.IN_PROCESSING");
    expect(getHelpEntry("orders.payment.paid")!.localizationKeys.title).toBe("order.payment.PAID");
    // Bookings → booking.status.*
    expect(getHelpEntry("bookings.status.awaiting_confirmation")!.localizationKeys.title).toBe(
      "booking.status.AWAITING_CONFIRMATION",
    );
    // Payments → status.entity.*
    expect(getHelpEntry("payments.status.captured")!.localizationKeys.title).toBe("status.entity.CAPTURED");
    expect(getHelpEntry("payments.refund.status.processed")!.localizationKeys.title).toBe("status.entity.PROCESSED");
  });

  it("binding micro-closure: RU titles equal the canonical page labels", () => {
    expect(helpTitle(getHelpEntry("requests.kpi.total")!, "ru")).toBe("Всего заявок");
    expect(helpTitle(getHelpEntry("requests.status.new")!, "ru")).toBe("Новые");
    expect(helpTitle(getHelpEntry("orders.kpi.total")!, "ru")).toBe("Всего заказов");
    expect(helpTitle(getHelpEntry("orders.status.new")!, "ru")).toBe("Новый");
    expect(helpTitle(getHelpEntry("orders.payment.paid")!, "ru")).toBe("Оплачен");
    expect(helpTitle(getHelpEntry("bookings.kpi.total")!, "ru")).toBe("Всего бронирований");
    expect(helpTitle(getHelpEntry("bookings.status.confirmed")!, "ru")).toBe("Подтверждено");
    expect(helpTitle(getHelpEntry("payments.kpi.total")!, "ru")).toBe("Всего платежей");
    expect(helpTitle(getHelpEntry("payments.status.captured")!, "ru")).toBe("Зачислен");
    expect(helpTitle(getHelpEntry("payments.refund.status.processed")!, "ru")).toBe("Обработан");
  });

  it("titles never leak the raw enum code", () => {
    for (const e of HELP_REGISTRY) {
      const title = helpTitle(e, "ru");
      const tail = e.id.split(".").pop() as string;
      const code = tail.toUpperCase().replace(/_/g, "_");
      expect(title, `${e.id}`).not.toBe(code);
    }
  });

  it("every status title resolves through the canonical title key in RU/AZ/EN (page == Help)", () => {
    for (const e of HELP_STATUS_ENTRIES) {
      for (const loc of LOCALES) {
        const viaKey = t(e.localizationKeys.title, loc);
        expect(viaKey, `${e.id} ${loc}`).not.toBe(e.localizationKeys.title);
      }
    }
  });
});

describe("UI-C1.2H — cross-entry semantics", () => {
  it("kpi total entries exist for all 4 domains", () => {
    for (const domain of ["requests", "orders", "bookings", "payments"]) {
      expect(getHelpEntry(`${domain}.kpi.total`)?.type).toBe("kpi");
    }
  });

  it("Payments refund statuses never claim PaymentStatus semantics (id + group both distinct)", () => {
    for (const code of REFUND_STATUSES) {
      const e = getHelpEntry(`payments.refund.status.${code.toLowerCase()}`)!;
      expect(e.domain).toBe("payments");
      expect(e.id).toMatch(/^payments\.refund\.status\./);
      expect(e.group).toBe("payments.group.refund_statuses");
    }
  });

  it("registry helper lookups: unknown id → undefined; domains partition the registry", () => {
    expect(getHelpEntry("nope.does_not_exist")).toBeUndefined();
    const total = byDomain("requests").length + byDomain("orders").length + byDomain("bookings").length + byDomain("payments").length;
    expect(total).toBe(HELP_REGISTRY.length);
  });

  it("helpT falls back to the main dictionary for titles and returns the key for truly unknown keys", () => {
    expect(helpT("order.status.CLOSED", "ru")).toBe("Закрыт");
    expect(helpT("help.no.such.key", "ru")).toBe("help.no.such.key");
    const entry = getHelpEntry("orders.status.closed")!;
    expect(helpTitle(entry, "ru")).toBe(helpT(entry.localizationKeys.title, "ru"));
  });
});

describe("UI-C1.2H.1 §4/§8/§14 — global taxonomy model extension (zero content change)", () => {
  it("HELP_AREAS exposes the full evidence-grounded platform taxonomy (future areas included)", () => {
    expect(HELP_AREAS).toEqual([
      "platform",
      "command-center",
      "analytics",
      "operations",
      "finance",
      "sales",
      "catalog",
      "crm",
      "marketing",
      "support",
      "admin",
      "marketplace",
      "shared",
    ]);
    for (const area of HELP_AREAS) expect(area).toMatch(/^[a-z-]+$/);
  });

  it("domain→area mapping matches canonical shell ownership (operations: requests/orders/bookings; finance: payments)", () => {
    expect(HELP_AREA_BY_DOMAIN).toEqual({
      requests: "operations",
      orders: "operations",
      bookings: "operations",
      payments: "finance",
    });
    expect(helpAreaOf({ domain: "requests" })).toBe("operations");
    expect(helpAreaOf({ domain: "payments" })).toBe("finance");
  });

  it("every entry resolves to an area; areas partition the registry; content areas = operations + finance only", () => {
    for (const e of HELP_REGISTRY) {
      const area = helpAreaOf(e);
      expect(["operations", "finance"]).toContain(area);
    }
    expect([...HELP_CONTENT_AREAS].sort()).toEqual(["finance", "operations"]);
    const byArea = HELP_AREAS.reduce((sum, a) => sum + helpEntriesByArea(a).length, 0);
    expect(byArea).toBe(HELP_REGISTRY.length);
  });

  it("no invented content: every FUTURE area has exactly zero entries", () => {
    const future = HELP_AREAS.filter((a) => !HELP_CONTENT_AREAS.includes(a));
    for (const area of future) expect(helpEntriesByArea(area), `future area ${area}`).toHaveLength(0);
  });

  it("entry-type model supports concept/formula/workflow/policy, but the 68 current entries use only kpi/status/group", () => {
    expect(HELP_ENTRY_TYPES).toEqual(["kpi", "status", "group", "concept", "formula", "workflow", "policy"]);
    const counts: Record<string, number> = {};
    for (const e of HELP_REGISTRY) {
      expect(["kpi", "status", "group"]).toContain(e.type);
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    expect(counts).toEqual({ kpi: 4, status: 51, group: 13 });
  });

  it("relationship fields (relatedMetrics/relatedStatuses/relatedConcepts) reference existing stable IDs only", () => {
    for (const e of HELP_REGISTRY) {
      for (const ids of [e.relatedMetrics, e.relatedStatuses, e.relatedConcepts] as const) {
        if (!ids) continue;
        expect(new Set(ids).size, `${e.id} no duplicate refs`).toBe(ids.length);
        for (const id of ids) {
          expect(ALL_HELP_IDS, `${e.id} → ${id}`).toContain(id);
          expect(id, `${e.id} no self-reference`).not.toBe(e.id);
        }
      }
    }
  });

  it("context metadata: workspace resolves to default 'both'; aliases/entitlement/relationships unset on all 68 entries (zero-content guard)", () => {
    for (const e of HELP_REGISTRY) {
      expect(helpWorkspaceOf(e)).toBe("both");
      expect(e.workspace).toBeUndefined();
      expect(e.entitlement).toBeUndefined();
      expect(e.aliases).toBeUndefined();
      expect(e.relatedMetrics).toBeUndefined();
      expect(e.relatedStatuses).toBeUndefined();
      expect(e.relatedConcepts).toBeUndefined();
    }
  });
});
