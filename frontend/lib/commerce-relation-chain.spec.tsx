// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import CommerceRelationChain from "@/components/commerce/CommerceRelationChain";
import { LocaleProvider, t } from "./i18n";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function count(src: string, s: string): number {
  return src.split(s).length - 1;
}

describe("UI-C2 CommerceRelationChain — source integration", () => {
  it("is imported exactly once by each canonical detail page, with the correct current node", () => {
    const req = read("app/app/requests/[id]/page.tsx");
    const ord = read("app/app/orders/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    expect(count(req, "<CommerceRelationChain")).toBe(1);
    expect(count(ord, "<CommerceRelationChain")).toBe(1);
    expect(count(bkg, "<CommerceRelationChain")).toBe(1);
    expect(req).toContain('current="request"');
    expect(ord).toContain('current="order"');
    expect(bkg).toContain('current="booking"');
  });

  it("feeds whole server-authoritative objects — no frontend-derived relation state on pages", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    const bkg = read("app/app/bookings/[id]/page.tsx");
    // Linked entities are passed as whole DTO objects (nullable), never synthesized client-side.
    expect(ord).toContain('request={order.linkedRequest ?? null}');
    expect(ord).toContain('booking={order.linkedBooking ?? null}');
    expect(ord).toContain("order={order}");
    expect(bkg).toContain('request={booking.linkedRequest ?? null}');
    expect(bkg).toContain('order={booking.linkedOrder ?? null}');
    expect(bkg).toContain("booking={booking}");
    expect(bkg).toContain("linkedOrder?: { id: string; referenceNumber: string; status: string } | null;");
    expect(bkg).toContain("linkedRequest?: { id: string; referenceNumber: string; status: string } | null;");
  });

  it("Booking detail backend DTO supplies linkedOrder/linkedRequest (service-only, no endpoint change)", () => {
    const be = path.join(ROOT, "..", "backend", "src", "modules", "booking", "booking-query.service.ts");
    expect(existsSync(be)).toBe(true);
    const src = readFileSync(be, "utf8");
    expect(src).toContain("linkedOrder");
    expect(src).toContain("linkedRequest");
    expect(src).toContain("referenceNumber: true, amount: true");
  });

  it("shared component is the only renderer of relation statuses (no raw-enum handling on pages)", () => {
    const chain = read("components/commerce/CommerceRelationChain.tsx");
    expect(chain).toContain("<StatusBadge status={entity.status} />");
    expect(chain).toContain("EntityLink");
    // The component never invents status semantics or lifecycle claims.
    expect(chain).not.toContain("PARTIALLY_CONFIRMED");
    expect(chain).not.toContain("CASH");
    // Arrows are decorative relation indicators only.
    expect(chain).toContain("aria-hidden");
  });
});

describe("UI-C2 CommerceRelationChain — render semantics", () => {
  const NODE_REQ = { id: "req-1", referenceNumber: "MKT-REQ-0001", status: "CUSTOMER_ACCEPTED" };
  const NODE_ORD = { id: "ord-1", referenceNumber: "MKT-ORD-0001", status: "FULFILLED" };
  const NODE_BKG = { id: "bkg-1", referenceNumber: "MKT-BKG-0001", status: "CONFIRMED" };

  it("renders real deep links to canonical detail routes", () => {
    const { container } = render(
      <LocaleProvider>
        <CommerceRelationChain locale="ru" current="order" request={NODE_REQ} order={NODE_ORD} booking={NODE_BKG} />
      </LocaleProvider>
    );
    const links = Array.from(container.querySelectorAll("a")) as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute("href"))).toContain("/app/requests/req-1");
    expect(links.map((a) => a.getAttribute("href"))).toContain("/app/orders/ord-1");
    expect(links.map((a) => a.getAttribute("href"))).toContain("/app/bookings/bkg-1");
  });

  it("marks the current entity with aria-current + a localized chip", () => {
    const { container } = render(
      <LocaleProvider>
        <CommerceRelationChain locale="ru" current="order" request={NODE_REQ} order={NODE_ORD} booking={null} />
      </LocaleProvider>
    );
    const current = container.querySelector('[aria-current="true"]');
    expect(current).toBeTruthy();
    expect(current?.textContent).toContain(t("detail.chain.current", "ru"));
  });

  it("absent nodes render a muted localized state and no link", () => {
    const { container } = render(
      <LocaleProvider>
        <CommerceRelationChain locale="ru" current="booking" request={null} order={NODE_ORD} booking={NODE_BKG} />
      </LocaleProvider>
    );
    expect(container.textContent).toContain(t("detail.relation.no_request", "ru"));
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/app/requests/");
    // Present nodes keep their links.
    expect(hrefs).toContain("/app/orders/ord-1");
    expect(hrefs).toContain("/app/bookings/bkg-1");
  });

  it("absent labels and current chip resolve in RU/AZ/EN (never raw keys)", () => {
    for (const loc of ["ru", "az", "en"] as const) {
      expect(t("detail.relation.no_request", loc)).not.toBe("detail.relation.no_request");
      expect(t("detail.relation.no_order", loc)).not.toBe("detail.relation.no_order");
      expect(t("detail.relation.no_booking", loc)).not.toBe("detail.relation.no_booking");
      expect(t("detail.chain.current", loc)).not.toBe("detail.chain.current");
    }
    expect(t("detail.chain.current", "ru")).toBe("Текущая");
  });

  it("orders row was superseded by the chain — no leftover duplicated row markup on the Order page", () => {
    const ord = read("app/app/orders/[id]/page.tsx");
    expect(ord).not.toContain("EntityStatusBadgesCell");
  });
});
