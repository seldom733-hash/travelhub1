/**
 * Supplier Markup (STRICT PROMPT §23, Gate J) — PricingController RBAC metadata.
 *
 * Каждый endpoint обязан требовать ТОЛЬКО канонические pricing.markup.*;
 * НИ ОДИН не должен зависеть от supplier.search.* (undeclared → fail-closed
 * 403, audit дефект). Метаданные читаются тем же ключом (PERMISSIONS_KEY),
 * который использует PermissionsGuard.
 */
import "reflect-metadata";
import { PERMISSIONS_KEY } from "../../security/auth/decorators";
import { PERMISSIONS } from "../../security/permissions.constants";
import { PricingController } from "./pricing.controller";
import type { MarkupMatrixService } from "./markup-matrix.service";
import type { MarkupRuleService } from "./markup-rule.service";

type RouteSpec = { method: string; path: string; handler: string };

const ROUTES: RouteSpec[] = [
  { method: "GET", path: "markup-matrix", handler: "getMarkupMatrix" },
  { method: "GET", path: "markup-rules", handler: "listMarkupRules" },
  { method: "GET", path: "markup-rules/resolve", handler: "resolveMarkupRule" },
  { method: "GET", path: "markup-rules/:code", handler: "getMarkupRule" },
  { method: "GET", path: "markup-rules/:code/history", handler: "getMarkupRuleHistory" },
  { method: "POST", path: "markup-rules", handler: "createMarkupRule" },
  { method: "PATCH", path: "markup-rules/:code", handler: "updateMarkupRule" },
  { method: "POST", path: "markup-rules/:code/activate", handler: "activateMarkupRule" },
  { method: "POST", path: "markup-rules/:code/archive", handler: "archiveMarkupRule" },
];

function requiredPermissionsOf(handler: string): string[] {
  const target = (PricingController.prototype as unknown as Record<string, unknown>)[handler];
  const meta = Reflect.getMetadata(PERMISSIONS_KEY, target as object) as string[];
  if (!Array.isArray(meta)) throw new Error(`handler ${handler} has no permission metadata`);
  return meta;
}

describe("PricingController RBAC (Gate J)", () => {
  const svc = {} as MarkupRuleService;
  const matrix = {} as MarkupMatrixService;

  it("controller instantiates (wiring)", () => {
    expect(new PricingController(svc, matrix)).toBeDefined();
  });

  it.each(ROUTES)("$method $path requires pricing.markup.* only", ({ method, handler }) => {
    const required = requiredPermissionsOf(handler);
    expect(required).toHaveLength(1);
    expect(["pricing.markup.read", "pricing.markup.manage"]).toContain(required[0]);
    expect(required.every((p) => p.startsWith("pricing.markup."))).toBe(true);
    expect(required.some((p) => p.startsWith("supplier.search."))).toBe(false);
  });

  it("read endpoints require pricing.markup.read", () => {
    for (const route of ROUTES.filter((r) => r.method === "GET" && r.handler !== "resolveMarkupRule")) {
      expect(requiredPermissionsOf(route.handler)).toEqual(["pricing.markup.read"]);
    }
  });

  it("lifecycle endpoints require pricing.markup.manage", () => {
    for (const route of ROUTES.filter((r) => r.method !== "GET")) {
      expect(requiredPermissionsOf(route.handler)).toEqual(["pricing.markup.manage"]);
    }
  });

  it("permissions are declared in canonical PERMISSIONS registry (fail-closed guard)", () => {
    expect(Object.keys(PERMISSIONS)).toContain("pricing.markup.read");
    expect(Object.keys(PERMISSIONS)).toContain("pricing.markup.manage");
  });

  it("§6.8 unrelated permission → not sufficient (no route accepts anything outside pricing.markup.*)", () => {
    const unrelated = [
      "sales.discount.grant",
      "catalog.product.write",
      "order.read",
      "finance.commission.manage",
      "dashboard.financial.read",
    ];
    for (const route of ROUTES) {
      const required = requiredPermissionsOf(route.handler);
      expect(required.some((p) => unrelated.includes(p))).toBe(false);
      expect(required.every((p) => p.startsWith("pricing.markup."))).toBe(true);
    }
    // unrelated-права вообще существуют в реестре → 403-е в e2e (T2) реальны
    for (const p of unrelated) expect(Object.keys(PERMISSIONS)).toContain(p);
  });
});
