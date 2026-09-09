// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import BookingActionBar from "@/components/booking/BookingActionBar";
import RequestActionBar from "@/components/request/RequestActionBar";
import { t } from "./i18n";

// UI-C9: canonical 13 BookingAction identifiers (backend booking.service.ts).
const ALL_BOOKING_ACTIONS: string[] = [
  "prepare",
  "send",
  "requestClarification",
  "resume",
  "confirm",
  "reject",
  "service",
  "requestChange",
  "resolveChange",
  "requestCancellation",
  "complete",
  "cancel",
  "problem",
];

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const DETAIL_PAGES = [
  "app/app/requests/[id]/page.tsx",
  "app/app/orders/[id]/page.tsx",
  "app/app/bookings/[id]/page.tsx",
];

describe("R2 Detail Visual System Parity — shared primitives consumed by all 3 details", () => {
  const REQUIRED_IMPORTS: Array<[string, string]> = [
    ["EntityDetailShell", "@/components/EntityDetailShell"],
    ["EntityDetailHeader", "@/components/EntityDetailHeader"],
    ["EntitySectionCard", "@/components/commerce/EntitySectionCard"],
    ["EntityField", "@/components/commerce/EntityField"],
    ["StatusBadge", "@/components/StatusBadge"],
  ];

  for (const rel of DETAIL_PAGES) {
    const src = read(rel);
    describe(rel, () => {
      for (const [name, mod] of REQUIRED_IMPORTS) {
        it(`imports ${name} from ${mod}`, () => {
          expect(src).toContain(`import ${name} from "${mod}"`);
        });
      }
      it("uses EntitySectionCard (no floating free-form detail groups)", () => {
        expect(src.match(/<EntitySectionCard/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
      });
      it("uses Shared EntityDetailHeader (not PageHeader)", () => {
        expect(src).not.toContain('<PageHeader');
        expect(src).toContain('<EntityDetailHeader');
      });
    });
  }

  it("all three details import shared link/timeline/finance primitives where applicable", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    const ord = read("app/app/orders/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(req).toContain("EntityTimeline");
    expect(bkg).toContain("EntityTimeline");
    // R2: Order lifecycle presentation now uses the same EntityTimeline grammar
    expect(ord).toContain("EntityTimeline");
    expect(ord).toContain("<EntityTimeline items={milestones} />");
    expect(ord).toContain("EntityFinanceCell");
    expect(bkg).toContain("EntityFinanceCell");
    expect(req).toContain("CommerceRelationChain"); // UI-C2: relation linking moved to the shared chain
    expect(ord).toContain("EntityLink");
    expect(bkg).toContain("EntityLink");
  });

  it("all three details share the EntityRow list-row grammar for payments/refunds/items/history", () => {
    for (const rel of DETAIL_PAGES) {
      const src = read(rel);
      expect(src).toContain('import EntityRow from "@/components/commerce/EntityRow"');
    }
  });

  it("EntityTimeline is locale-aware (no hardcoded ru-RU timestamps)", () => {
    const tl = read("components/commerce/EntityTimeline.tsx");
    expect(tl).toContain("LOCALE_TAGS");
    expect(tl).not.toContain('toLocaleString("ru-RU")');
  });

  it("Order/Booking detail pages never hardcode ru-RU date formatting", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(ord).not.toContain('toLocaleString("ru-RU")');
    expect(bkg).not.toContain('toLocaleString("ru-RU")');
  });

  it("Request detail labels are localized through i18n (RU/AZ/EN parity on touched surface)", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    expect(req).toContain('t("requests.quantity", locale)');
    expect(req).toContain('t("requests.decision", locale)');
    expect(req).toContain('t("requests.supplier_deadline", locale)');
    expect(req).toContain('t("detail.sections.timeline", locale)');
    expect(req).toContain('t("crm.col.amount", locale)');
    expect(req).toContain('t("crm.col.reason", locale)');
  });

  it("Order detail audit labels + traveler fields are localized via i18n keys (shared EntityAuditHistory)", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    const audit = read("components/commerce/EntityAuditHistory.tsx");
    // Page supplies the localized mappers + Order-specific field renderers.
    expect(ord).toContain("actionLabel={orderActionLabel}");
    expect(ord).toContain("fieldLabel={fieldLabel}");
    expect(ord).toContain("renderFieldValue={renderFieldValue}");
    expect(ord).toContain('emptyText={t("bookings.history_disclaimer", locale)}');
    // Shared grammar keeps the localized audit strings (never raw RU).
    expect(audit).toContain('ti("order.history.show_more", locale');
    expect(audit).toContain('ti("order.history.author", locale');
    expect(audit).toContain('t("order.history.redacted", locale)');
    expect(audit).toContain('t("bookings.change_history", locale)');
    expect(audit).not.toContain('toLocaleString("ru-RU")');
  });

  it("Booking detail hides the header action area when no actions are available (no technical placeholder text)", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    // UI-C9: empty-projection omission lives in BookingActionBar (returns null when actions.length === 0).
    const bar = read("components/booking/BookingActionBar.tsx");
    expect(bar).toContain("if (actions.length === 0)");
    expect(bar).toContain("return null;");
    expect(bkg).not.toContain("Для текущего статуса команд нет");
  });
});

describe("R2 Detail Visual System Parity — raw enum leakage removed on touched surfaces", () => {
  const req = read("app/app/requests/[id]/page.tsx");
  const ord = read("app/app/orders/[id]/page.tsx");
  const bkg = read("app/app/bookings/[id]/page.tsx");

  it("Request: relation identity/status is delegated to the shared CommerceRelationChain (UI-C2); payments/refund/decisions stay local StatusBadge", () => {
    const count = (s: string) => req.split(s).length - 1;
    // UI-C2: linked Order/Booking nodes are fed whole (server-authoritative objects) into ONE shared chain —
    // the page itself no longer touches linked-entity status enums (raw-enum guarantee lives in the shared component).
    expect(count("<CommerceRelationChain")).toBe(1);
    expect(req).toContain('current="request"');
    expect(req).toContain('order={r.convertedOrder}');
    expect(req).toContain('booking={r.convertedBooking ?? null}');
    expect(count("r.convertedOrder.status")).toBe(0);
    expect(count("r.convertedBooking.status")).toBe(0);
    // supplier/customer decision appear twice: once in the render condition, once inside StatusBadge
    expect(count("r.supplierDecision")).toBe(2);
    expect(count("r.customerDecision")).toBe(2);
    expect(count("(r as any).convertedRefund.status")).toBe(1);
    expect(req).toContain("<StatusBadge status={r.supplierDecision} />");
    expect(req).toContain("<StatusBadge status={r.customerDecision} />");
    expect(req).toContain("<StatusBadge status={(r as any).convertedRefund.status} />");
    // Localized decision statuses exist
    expect(t("status.decision.ACCEPTED", "ru")).toBe("Принято");
    expect(t("status.decision.DECLINED", "ru")).toBe("Отклонено");
  });

  it("Order: linked Request/Booking are fed whole into the shared CommerceRelationChain (UI-C2)", () => {
    const count = (s: string) => ord.split(s).length - 1;
    expect(count("<CommerceRelationChain")).toBe(1);
    expect(ord).toContain('current="order"');
    expect(ord).toContain('request={order.linkedRequest ?? null}');
    expect(ord).toContain('booking={order.linkedBooking ?? null}');
    expect(count("order.linkedRequest.status")).toBe(0);
    expect(count("order.linkedBooking.status")).toBe(0);
  });

  it("Booking: audit transition statuses render only via StatusBadge (shared EntityAuditHistory)", () => {
    const audit = read("components/commerce/EntityAuditHistory.tsx");
    // The page no longer touches raw from/to — the shared component renders transitions only through StatusBadge.
    expect(bkg).not.toContain("h.from");
    expect(bkg).not.toContain("h.to");
    expect(audit).toContain("<StatusBadge status={h.from} />");
    expect(audit).toContain("<StatusBadge status={h.to} />");
  });

  it("Payment/refund entity statuses and Booking passenger completeness are localized", () => {
    expect(t("status.entity.FAILED", "ru")).toBe("Ошибка");
    expect(t("status.entity.REQUESTED", "ru")).toBe("Запрошен");
    expect(t("status.entity.PROCESSED", "ru")).toBe("Обработан");
    // COMPLETE passenger data is mapped to canonical CONFIRMED badge in Booking page source
    expect(bkg).toContain('p.dataCompleteness === "COMPLETE" ? "CONFIRMED" : "WAITING_FOR_DATA"');
  });
});

describe("R2 TOTAL KPI micro-closure — canonical labels + size variant", () => {
  it("TOTAL labels are exactly canonical on all 3 registries (RU/AZ/EN)", () => {
    expect(t("requests.kpi.total", "ru")).toBe("Всего заявок");
    expect(t("requests.kpi.total", "az")).toBeTruthy();
    expect(t("requests.kpi.total", "en")).toBe("Total requests");
    expect(t("admin.kpi.total_orders", "ru")).toBe("Всего заказов");
    expect(t("admin.kpi.total_bookings", "ru")).toBe("Всего бронирований");
  });

  it("all three registries use variant=total and NOT full-width wrapper", () => {
    const req = read("app/app/requests/page.tsx");
    const ord = read("app/app/orders/page.tsx");
    const bkg = read("app/app/bookings/page.tsx");
    for (const src of [req, ord, bkg]) {
      expect(src).toContain('variant="total"');
      expect(src).toContain('className="w-fit max-w-full"');
    }
    expect(req).toContain('label={t("requests.kpi.total", locale)}');
    expect(ord).toContain('label={t("admin.kpi.total_orders", locale)}');
    expect(bkg).toContain('label={t("admin.kpi.total_bookings", locale)}');
  });

  it("CommerceKpiCard total variant is ~15-20% larger than ordinary card", () => {
    // Default card: value text-lg, label text-xs, px-4 py-3
    render(<CommerceKpiCard label="Статус" value={5} />);
    const defaultLabel = screen.getByText("Статус");
    expect(defaultLabel.className).toContain("text-xs");
    const defaultValue = screen.getByText("5");
    expect(defaultValue.className).toContain("text-lg");
  });

  it("CommerceKpiCard total variant: larger label/value typography and padding", () => {
    render(<CommerceKpiCard variant="total" label="Всего заказов" value={42} />);
    const totalLabel = screen.getByText("Всего заказов");
    expect(totalLabel.className).toContain("text-sm");
    const totalValue = screen.getByText("42");
    expect(totalValue.className).toContain("text-[21px]");
    const button = screen.getByRole("button");
    expect(button.className).toContain("px-5");
    expect(button.className).toContain("py-4");
  });
});

describe("R3 Page Composition & Information Hierarchy Parity — shared two-zone layout", () => {
  it("all three details consume the shared EntityDetailLayout/Main/Aside/Wide primitives", () => {
    for (const rel of DETAIL_PAGES) {
      const src = read(rel);
      expect(src).toContain("EntityDetailLayout");
      expect(src).toContain("EntityDetailMain");
      expect(src).toContain("EntityDetailAside");
      expect(src).toContain("EntityDetailWide");
    }
  });

  it("all three pages use the shared Details/meta aside slot (same section title key)", () => {
    for (const rel of DETAIL_PAGES) {
      const src = read(rel);
      expect(src).toContain('t("detail.sections.details", locale)');
    }
    const req = read("app/app/requests/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    // Request/Booking meta cards use the shared commerce-sequence label (field exists);
    // Order meta card uses its own code/number fields (no commerceSequence in DTO).
    expect(req).toContain('t("detail.details.sequence", locale)');
    expect(bkg).toContain('t("detail.details.sequence", locale)');
  });

  it("Order and Booking Finance cards share identical grid breakpoint behavior", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
    expect(ord).toContain(GRID);
    expect(bkg).toContain(GRID);
  });

  it("the shared layout primitive owns the page composition grid (no page-level wrapper)", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    const ord = read("app/app/orders/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    for (const src of [req, ord, bkg]) {
      // composition root is the shared primitive, not a page-defined grid div
      expect(src).toContain("<EntityDetailLayout>");
      expect(src).not.toContain('className="grid grid-cols-1 gap-4 lg:grid-cols-3"');
    }
  });

  it("Booking audit history lives in the shared lower (Wide) slot, not the context aside", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    // Shared audit section is inside an EntityDetailWide block
    const wideIdx = bkg.indexOf("<EntityDetailWide");
    const historyIdx = bkg.indexOf("<EntityAuditHistory");
    expect(wideIdx).toBeGreaterThan(-1);
    expect(historyIdx).toBeGreaterThan(wideIdx);
    // Timeline stays in the aside context column
    const asideIdx = bkg.indexOf("<EntityDetailAside");
    const timelineIdx = bkg.indexOf("<EntityTimeline items={milestones} />");
    expect(timelineIdx).toBeGreaterThan(asideIdx);
  });
});

describe("R2 Detail Visual System Parity — action authority not moved client-side", () => {
  it("Order action availability stays server-authoritative (availableActions from API)", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    expect(ord).toContain("actions={order.availableActions ?? []}");
    expect(ord).toContain("api.patch(`/orders/${order.id}`");
  });

  it("Booking action availability stays server-authoritative (availableActions from API)", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    // UI-C9: the projection is passed verbatim to BookingActionBar — no local recompute.
    expect(bkg).toContain("actions={booking.availableActions ?? []}");
    expect(bkg).toContain("<BookingActionBar");
    expect(bkg).toContain("api.patch(`/bookings/${booking.id}`");
  });

  it("BookingActionBar consumes only the server projection (UI-C9): all 13 actions, stable ordering, accessible busy state", () => {
    const bar = read("components/booking/BookingActionBar.tsx");
    expect(bar).toContain("actions: string[]");
    expect(bar).not.toContain("booking.status");
    expect(bar).not.toContain("useCan");
    expect(bar).toContain("aria-busy={busy}");
    expect(bar).not.toContain('"…"');

    for (const key of [
      ...ALL_BOOKING_ACTIONS.map((a) => `booking.action_short.${a}`),
      "booking.action.busy",
    ]) {
      for (const locale of ["ru", "az", "en"] as const) {
        expect(t(key, locale)).not.toBe(key);
      }
    }

    const onRun = vi.fn();
    render(<BookingActionBar actions={ALL_BOOKING_ACTIONS} busyAction={null} onRun={onRun} />);
    const buttons = screen.getAllByRole("button");
    // All 13 identifiers render, in projection order (ordering stability).
    expect(buttons.map((b) => b.textContent)).toEqual(
      ALL_BOOKING_ACTIONS.map((a) => t(`booking.action_short.${a}`, "ru")),
    );
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onRun).toHaveBeenCalledWith("send");

    // Empty projection → the action area is omitted (no placeholder).
    const empty = render(<BookingActionBar actions={[]} busyAction={null} onRun={onRun} />);
    expect(empty.container.querySelector("button")).toBeNull();

    // Busy: localized readable label + aria-busy + disabled mutual exclusion.
    render(<BookingActionBar actions={["send"]} busyAction="send" onRun={onRun} />);
    const busyButton = screen.getByRole("button", { name: "Выполняется…" }) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);
    expect(busyButton.getAttribute("aria-busy")).toBe("true");
  });

  it("Booking action errors render in an inline header banner while load/not-found errors stay centered (UI-C9)", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(bkg).toContain("setActionError");
    expect(bkg).toContain("{actionError && <div");
    // Centered load/not-found state unchanged.
    expect(bkg).toContain('{error || t("crm.not_found", locale)}');
    // Action failure no longer swaps the page: executeAction writes actionError, not error.
    const execIdx = bkg.indexOf("const executeAction");
    const body = bkg.slice(execIdx, bkg.indexOf("}, [booking, loadBooking]);", execIdx));
    expect(body).toContain("setActionError((e as Error).message)");
    expect(body).not.toContain("setError((e as Error).message)");
  });

  it("Booking detail has no dead RU fallback literals (UI-C9 i18n cleanup)", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(bkg).not.toMatch(/\|\| "/);
  });

  it("Request actions are server-authoritative after UI-C6 (SEC-UI-01 closed by Request availableActions)", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    // Frontend must consume server-provided availableActions, not recompute from status arrays.
    // UI-C7: typed contract via RequestAvailableActions — the safe-default literal is preserved.
    expect(req).toContain("const actions: RequestAvailableActions = r.availableActions ?? {");
    expect(req).toContain("confirmPrice: false");
    expect(req).toContain("customerDecline: false");
    expect(req).toContain("convert: false");
    // Legacy status-array authority must be removed.
    expect(req).not.toContain('["NEW", "CHECKING", "PRICE_CHANGED"].includes(r.status)');
    expect(req).not.toContain('["CONFIRMED", "PRICE_CHANGED"].includes(r.status)');
    expect(req).not.toContain('r.status === "CUSTOMER_ACCEPTED" && !r.convertedOrderId');
    // Every action still round-trips to the server — no new client-side business rules.
    expect(req).toContain("runPost(`/requests/${id}/");
    expect(req).toContain("api.post(path, body ?? {})");
  });
});

describe("UI-C7 — Request UI Migration — header actions + presentation cleanup", () => {
  it("Request actions render in the canonical header actions slot via RequestActionBar", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    expect(req).toContain("import RequestActionBar");
    // CRLF-agnostic: actions={ user ? (<RequestActionBar ...>) : null } in the header slot.
    expect(req).toMatch(/actions=\{\s*user \? \(/);
    expect(req).toContain("<RequestActionBar");
    expect(req).toContain("availableActions={actions}");
    // The legacy inline MAIN actions card is gone.
    expect(req).not.toContain('title={t("detail.sections.actions", locale)}');
    // btn/TONES local primitives are removed from the page.
    expect(req).not.toContain("function btn(");
    expect(req).not.toContain("const TONES");
    // InfoRow alias is removed — EntityField is used directly.
    expect(req).not.toContain("function InfoRow");
    expect(req).toContain("<EntityField");
    // Dead client-permission artifact removed (no client-side permission computation).
    expect(req).not.toContain('useCan("order.edit_noncritical")');
    expect(req).not.toContain("const canEdit");
  });

  it("RequestActionBar consumes only availableActions (no status/permission authority)", () => {
    const bar = read("components/request/RequestActionBar.tsx");
    // Visibility strictly follows the server projection booleans.
    expect(bar).toContain("availableActions.confirmPrice");
    expect(bar).toContain("availableActions.proposePrice");
    expect(bar).toContain("availableActions.reject");
    expect(bar).toContain("availableActions.unavailable");
    expect(bar).toContain("availableActions.customerAccept");
    expect(bar).toContain("availableActions.customerDecline");
    expect(bar).toContain("availableActions.convert");
    // No client-side lifecycle/permission authority.
    expect(bar).not.toContain("RequestStatus");
    expect(bar).not.toContain("r.status");
    expect(bar).not.toContain("useCan");
    expect(bar).not.toContain("granted");
  });

  it("RequestActionBar preserves all seven actions with existing API paths and busy semantics", () => {
    const bar = read("components/request/RequestActionBar.tsx");
    expect(bar).toContain('onRun("confirm-price")');
    expect(bar).toContain("onPropose");
    expect(bar).toContain('onRun("reject")');
    expect(bar).toContain('onRun("unavailable")');
    expect(bar).toContain('onRun("customer-accept")');
    expect(bar).toContain('onRun("customer-decline")');
    expect(bar).toContain('onRun("convert")');
    // Busy gating preserved (no parallel actions while one executes).
    expect(bar).toContain("busyAction !== null");
    // Existing localized labels are reused.
    for (const key of [
      "reqflow.confirm_price",
      "reqflow.propose_price",
      "reqflow.reject",
      "reqflow.unavailable",
      "reqflow.customer_accept",
      "reqflow.customer_decline",
      "reqflow.convert_action",
      "reqflow.busy",
    ]) {
      expect(bar).toContain(`"${key}"`);
    }
  });

  it("RequestActionBar keeps the propose-price inline toggle UX (no modal/drawer) with an accessible name", () => {
    const bar = read("components/request/RequestActionBar.tsx");
    expect(bar).toContain('<input');
    expect(bar).toContain("aria-label=");
    expect(bar).not.toContain("<dialog");
    expect(bar).not.toContain("Drawer");
    expect(bar).not.toContain("Modal");
  });

  it("Request detail loading/error/not-found use the canonical centered pattern with back-to-list", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    expect(req).toContain('flex h-full items-center justify-center');
    expect(req).toContain('flex h-full flex-col items-center justify-center gap-4');
    expect(req).toContain('href="/app/requests"');
    expect(req).toContain("crm.loading");
    expect(req).toContain("crm.not_found");
    expect(req).toContain("crm.back_to_list");
    // Dead breadcrumb fallback literal removed.
    expect(req).not.toContain('|| "Заявки"');
  });

  it("RequestActionBar renders nothing without actionable actions (empty-area omission)", () => {
    // jsdom render — server projection all-false must produce no action UI.
    const { container } = render(
      <RequestActionBar
        locale="ru"
        availableActions={{
          confirmPrice: false,
          proposePrice: false,
          reject: false,
          unavailable: false,
          customerAccept: false,
          customerDecline: false,
          convert: false,
        }}
        busyAction={null}
        onRun={() => {}}
        onPropose={async () => true}
        onValidationMessage={() => {}}
      />,
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("RequestActionBar renders exactly the projected actions (customer actions for PRICE_CHANGED)", () => {
    const onRun = vi.fn();
    render(
      <RequestActionBar
        locale="ru"
        availableActions={{
          confirmPrice: false,
          proposePrice: false,
          reject: false,
          unavailable: false,
          customerAccept: true,
          customerDecline: true,
          convert: false,
        }}
        busyAction={null}
        onRun={onRun}
        onPropose={async () => true}
        onValidationMessage={() => {}}
      />,
    );
    const accept = screen.getByRole("button", { name: t("reqflow.customer_accept", "ru") });
    const decline = screen.getByRole("button", { name: t("reqflow.customer_decline", "ru") });
    expect(screen.queryByText(t("reqflow.confirm_price", "ru"))).toBeNull();
    expect(screen.queryByText(t("reqflow.convert_action", "ru"))).toBeNull();
    fireEvent.click(accept);
    expect(onRun).toHaveBeenCalledWith("customer-accept");
    fireEvent.click(decline);
    expect(onRun).toHaveBeenCalledWith("customer-decline");
  });

  it("RequestActionBar propose toggle: validation error path + successful post closes the input", async () => {
    const onValidationMessage = vi.fn();
    let proposed: number | null = null;
    const { unmount } = render(
      <RequestActionBar
        locale="ru"
        availableActions={{
          confirmPrice: false,
          proposePrice: true,
          reject: false,
          unavailable: false,
          customerAccept: false,
          customerDecline: false,
          convert: false,
        }}
        busyAction={null}
        onRun={() => {}}
        onPropose={async (price) => {
          proposed = price;
          return true;
        }}
        onValidationMessage={onValidationMessage}
      />,
    );
    // Open the inline toggle.
    fireEvent.click(screen.getByRole("button", { name: t("reqflow.propose_price", "ru") }));
    const input = screen.getByRole("textbox");
    // Empty submit → validation message, input stays open.
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onValidationMessage).toHaveBeenCalledWith(t("requests.price_invalid", "ru"));
    expect(screen.getByRole("textbox")).toBeTruthy();
    // Valid submit → onPropose called with the numeric price, input closes.
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(proposed).toBe(150));
    expect(screen.queryByRole("textbox")).toBeNull();
    unmount();
  });
});
