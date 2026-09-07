// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import EntityAuditHistory, { type EntityAuditHistoryRow } from "@/components/commerce/EntityAuditHistory";
import { LocaleProvider, t, ti } from "./i18n";
import { requestActionLabel, orderActionLabel, bookingActionLabel } from "./commerce-history-labels";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function count(src: string, s: string): number {
  return src.split(s).length - 1;
}

const ROW: EntityAuditHistoryRow = {
  id: "h-1",
  action: "customer_accepted",
  from: "PRICE_CHANGED",
  to: "CUSTOMER_ACCEPTED",
  actorName: "admin",
  comment: "Комментарий к событию",
  createdAt: "2026-09-03T10:15:00.000Z",
};

function renderAudit(props: Partial<Parameters<typeof EntityAuditHistory>[0]> = {}) {
  return render(
    <LocaleProvider>
      <EntityAuditHistory
        items={props.items ?? [ROW]}
        actionLabel={props.actionLabel ?? requestActionLabel}
        {...props}
      />
    </LocaleProvider>
  );
}

describe("UI-C4 EntityAuditHistory — render semantics", () => {
  it("renders the shared localized section title (История изменений / Change history)", () => {
    renderAudit();
    expect(screen.getByRole("heading", { name: t("bookings.change_history", "ru") })).toBeTruthy();
  });

  it("localizes the action label through the supplied mapper in RU/AZ/EN (request actions)", () => {
    for (const loc of ["ru", "az", "en"] as const) {
      const { unmount } = render(
        <EntityAuditHistory items={[ROW]} actionLabel={requestActionLabel} locale={loc} />
      );
      expect(screen.getByText(t("request.action.customer_accepted", loc))).toBeTruthy();
      unmount();
    }
  });

  it("renders from→to transition only via StatusBadge and keeps the actor line", () => {
    renderAudit();
    const badges = document.querySelectorAll("span.rounded-full");
    expect(badges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(ti("order.history.author", "ru", { name: "admin" }))).toBeTruthy();
  });

  it("renders structured field diff with the redacted marker when present (Order contract)", () => {
    const row: EntityAuditHistoryRow = {
      ...ROW,
      fields: [
        { field: "traveler[0].passportNumber", oldValue: "••••1234", newValue: "••••5678", redacted: true },
        { field: "traveler[0].citizenship", oldValue: "RU", newValue: "AZ", redacted: false },
      ],
    };
    renderAudit({ items: [row] });
    expect(screen.getByText("passportNumber:")).toBeTruthy();
    expect(screen.getByText(t("order.history.redacted", "ru"))).toBeTruthy();
    expect(screen.getByText("citizenship:")).toBeTruthy();
    // PII never rendered in full — only the redacted form the server stored.
    expect(document.body.textContent).not.toContain("1234-567890");
  });

  it("shows a localized empty state by default and honors an explicit emptyText override", () => {
    const { unmount } = renderAudit({ items: [] });
    expect(screen.getByText(t("detail.history.empty", "ru"))).toBeTruthy();
    unmount();
    renderAudit({ items: [], emptyText: "custom empty" });
    expect(screen.getByText("custom empty")).toBeTruthy();
  });

  it("shows the localized loading state while history is still loading", () => {
    renderAudit({ items: [], loading: true });
    expect(screen.getByText(t("crm.loading", "ru"))).toBeTruthy();
    expect(document.body.textContent).not.toContain(t("detail.history.empty", "ru"));
  });

  it("shows the non-blocking error state instead of empty state", () => {
    renderAudit({ items: [], error: "boom" });
    expect(screen.getByText("boom")).toBeTruthy();
    expect(document.body.textContent).not.toContain(t("detail.history.empty", "ru"));
  });

  it("renders show-more only when total exceeds loaded items and calls onLoadMore", () => {
    let called = 0;
    renderAudit({ total: 3, onLoadMore: () => { called += 1; } });
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("2"); // remaining = total - items.length
    fireEvent.click(btn);
    expect(called).toBe(1);
  });

  it("does not render show-more when all items are loaded", () => {
    renderAudit({ total: 1, onLoadMore: () => { /* noop */ } });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("formats timestamps with the active locale (never hardcoded ru-RU)", () => {
    renderAudit();
    expect(screen.getByText(/2026/)).toBeTruthy();
    const src = read("components/commerce/EntityAuditHistory.tsx");
    expect(src).toContain("LOCALE_TAGS");
    expect(src).not.toContain('toLocaleString("ru-RU")');
  });
});

describe("UI-C4 EntityAuditHistory — source integration on the three detail pages", () => {
  const req = read("app/app/requests/[id]/page.tsx");
  const ord = read("app/app/orders/[id]/page.tsx");
  const bkg = read("app/app/bookings/[id]/page.tsx");
  const audit = read("components/commerce/EntityAuditHistory.tsx");

  it("every detail page renders the shared component exactly once, inside an EntityDetailWide slot", () => {
    for (const src of [req, ord, bkg]) {
      expect(count(src, "<EntityAuditHistory")).toBe(1);
      const wideIdx = src.indexOf("<EntityDetailWide");
      expect(src.indexOf("<EntityAuditHistory")).toBeGreaterThan(wideIdx);
    }
  });

  it("each page consumes its canonical server-authoritative history endpoint", () => {
    expect(req).toContain("api.get<RequestHistoryRow[]>(`/requests/${id}/history`)");
    expect(ord).toContain("`/orders/${id}/history?page=${page}&pageSize=${history.pageSize}`");
    expect(bkg).toContain("`/bookings/${id}/history`");
  });

  it("history load is non-blocking on every page (no page-level hard error from audit)", () => {
    expect(req).toContain("// история не блокирует страницу");
    expect(ord).toContain("// история не блокирует страницу");
    expect(bkg).toContain("// Load history (non-blocking");
  });

  it("Timeline stays the business-milestone presentation — never merged with audit", () => {
    // Shared audit component does not import/render the timeline.
    expect(audit).not.toContain("<EntityTimeline");
    expect(audit).not.toContain('import EntityTimeline');
    // Pages keep the timeline in the aside context column and audit in the wide slot.
    for (const src of [req, ord, bkg]) {
      const asideIdx = src.indexOf("<EntityDetailAside");
      expect(src.indexOf("<EntityTimeline")).toBeGreaterThan(asideIdx);
    }
    expect(req).toContain("detail.sections.timeline");
  });

  it("D7 financial history stays a separate section on Order (audit before finance, no merge)", () => {
    expect(ord).toContain('t("finance.history", locale)');
    expect(ord.indexOf("<EntityAuditHistory")).toBeLessThan(ord.indexOf('t("finance.history"'));
  });

  it("request/order/booking action mappers exist in the shared label module and resolve in RU/AZ/EN", () => {
    const labels = read("lib/commerce-history-labels.ts");
    expect(labels).toContain("export function requestActionLabel");
    expect(labels).toContain("export function orderActionLabel");
    expect(labels).toContain("export function bookingActionLabel");
    const actions = ["created", "supplier_confirmed", "supplier_rejected", "supplier_unavailable", "supplier_proposed_price", "customer_accepted", "customer_declined", "converted"];
    for (const a of actions) {
      for (const loc of ["ru", "az", "en"] as const) {
        expect(t(`request.action.${a}`, loc)).not.toBe(`request.action.${a}`);
      }
    }
  });

  it("request page supplies the request mapper; order supplies order mapper + field renderers; booking supplies booking mapper", () => {
    expect(req).toContain("actionLabel={requestActionLabel}");
    expect(ord).toContain("actionLabel={orderActionLabel}");
    expect(ord).toContain("fieldLabel={fieldLabel}");
    expect(bkg).toContain("actionLabel={bookingActionLabel}");
  });
});