import { describe, expect, it } from "vitest";
import { canAccess, isRouteAllowed, matchRoute } from "./nav";

const finance = {
  role: "FINANCE",
  permissions: ["finance.overview.read", "finance.obligation.read", "finance.payment.read", "finance.ledger.read"],
};
const operator = {
  role: "OPERATOR",
  permissions: ["analytics.read", "order.read", "booking.read", "documents.read"],
};
const marketer = {
  role: "MARKETER",
  permissions: ["marketing.campaign.read", "sales.kpi.read", "crm.partner.read"],
};

describe("nav access", () => {
  it("supports any-of permissions and role allow-lists", () => {
    expect(canAccess(marketer, { permissions: ["crm.customer.read", "crm.partner.read"] })).toBe(true);
    expect(canAccess(finance, { permissions: ["crm.customer.read", "crm.partner.read"] })).toBe(false);
    expect(canAccess(finance, { permissions: ["finance.obligation.read"], roles: ["FINANCE"] })).toBe(true);
    expect(canAccess(operator, { permissions: ["finance.obligation.read"], roles: ["FINANCE"] })).toBe(false);
  });

  it("uses longest-prefix matches", () => {
    expect(matchRoute("/app/finance/supplier-payments")?.prefix).toBe("/app/finance/supplier-payments");
    expect(matchRoute("/app/crm/customers/123")?.prefix).toBe("/app/crm/customers");
    expect(matchRoute("/app/finance/deals/20260001")?.prefix).toBe("/app/finance/deals");
  });

  it("blocks routes whose permission is missing", () => {
    expect(isRouteAllowed("/app/finance/ledger", operator)).toBe(false);
    expect(isRouteAllowed("/app/finance/ledger", finance)).toBe(true);
    expect(isRouteAllowed("/app/marketing", marketer)).toBe(true);
    expect(isRouteAllowed("/app/analytics/sales", operator)).toBe(false);
  });

  it("enforces the payment-terms role gate even when the permission exists", () => {
    const analyst = { role: "ANALYST", permissions: ["finance.obligation.read"] };
    expect(isRouteAllowed("/app/finance/payment-terms", analyst)).toBe(false);
    expect(isRouteAllowed("/app/finance/payment-terms", finance)).toBe(true);
  });

  it("allows unknown /app paths (fail-open) and explicit allowlist entries", () => {
    expect(isRouteAllowed("/app/some-new-page", operator)).toBe(true);
    expect(isRouteAllowed("/app/dashboard", operator)).toBe(true);
    expect(isRouteAllowed("/app/help", operator)).toBe(true);
  });

  it("keeps deprecated registry routes guarded, not open by default", () => {
    expect(isRouteAllowed("/app/orders", operator)).toBe(true);
    expect(isRouteAllowed("/app/orders", marketer)).toBe(false);
  });
});
