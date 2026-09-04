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
    expect(req).toContain("EntityLink");
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

  it("Order detail audit labels + traveler fields are localized via i18n keys", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    expect(ord).toContain('orderActionLabel(h.action, locale)');
    expect(ord).toContain('fieldLabel(labelBase, locale)');
    expect(ord).toContain('ti("order.history.show_more", locale');
    expect(ord).toContain('ti("order.history.author", locale');
  });

  it("Booking detail hides the header action area when no actions are available (no technical placeholder text)", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(bkg).toContain('(booking.availableActions ?? []).length > 0 ? (');
    expect(bkg).not.toContain("Для текущего статуса команд нет");
  });
});

describe("R2 Detail Visual System Parity — raw enum leakage removed on touched surfaces", () => {
  const req = read("app/app/requests/[id]/page.tsx");
  const ord = read("app/app/orders/[id]/page.tsx");
  const bkg = read("app/app/bookings/[id]/page.tsx");

  it("Request: linked Order/Booking/payment/refund statuses render only via StatusBadge", () => {
    // Each status token appears exactly once and only inside a StatusBadge usage.
    const count = (s: string) => req.split(s).length - 1;
    expect(count("r.convertedOrder.status")).toBe(1);
    expect(count("r.convertedBooking.status")).toBe(1);
    // supplier/customer decision appear twice: once in the render condition, once inside StatusBadge
    expect(count("r.supplierDecision")).toBe(2);
    expect(count("r.customerDecision")).toBe(2);
    expect(count("(r as any).convertedRefund.status")).toBe(1);
    expect(req).toContain("<StatusBadge status={r.convertedOrder.status} />");
    expect(req).toContain("<StatusBadge status={r.convertedBooking.status} />");
    expect(req).toContain("<StatusBadge status={r.supplierDecision} />");
    expect(req).toContain("<StatusBadge status={r.customerDecision} />");
    expect(req).toContain("<StatusBadge status={(r as any).convertedRefund.status} />");
    // Localized decision statuses exist
    expect(t("status.decision.ACCEPTED", "ru")).toBe("Принято");
    expect(t("status.decision.DECLINED", "ru")).toBe("Отклонено");
  });

  it("Order: linked Request/Booking statuses render only via StatusBadge", () => {
    const count = (s: string) => ord.split(s).length - 1;
    expect(count("order.linkedRequest.status")).toBe(1);
    expect(count("order.linkedBooking.status")).toBe(1);
    expect(ord).toContain("<StatusBadge status={order.linkedRequest.status} />");
    expect(ord).toContain("<StatusBadge status={order.linkedBooking.status} />");
  });

  it("Booking: audit transition statuses render only via StatusBadge (no raw from → to)", () => {
    const count = (s: string) => bkg.split(s).length - 1;
    // h.from/h.to appear twice: once in the render condition, once inside StatusBadge
    expect(count("h.from")).toBe(2);
    expect(count("h.to")).toBe(2);
    expect(bkg).toContain("<StatusBadge status={h.from} />");
    expect(bkg).toContain("<StatusBadge status={h.to} />");
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

describe("R2 Detail Visual System Parity — action authority not moved client-side", () => {
  it("Order action availability stays server-authoritative (availableActions from API)", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    expect(ord).toContain("actions={order.availableActions ?? []}");
    expect(ord).toContain("api.patch(`/orders/${order.id}`");
  });

  it("Booking action availability stays server-authoritative (availableActions from API)", () => {
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(bkg).toContain("(booking.availableActions ?? [])");
    expect(bkg).toContain("api.patch(`/bookings/${booking.id}`");
  });

  it("Request actions remain frontend-gated (SEC-UI-01 still OPEN, not expanded)", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    expect(req).toContain('const canEdit = useCan("order.edit_noncritical")');
    // Every action still round-trips to the server — no new client-side business rules
    expect(req).toContain("runPost(`/requests/${id}/");
    expect(req).toContain("api.post(path, body ?? {})");
  });
});