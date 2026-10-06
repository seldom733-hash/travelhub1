/**
 * Supplier Markup (STRICT PROMPT §4.1, Gate A) — MarkupMatrixService.
 *
 * Матрица строится ИЗ РЕЕСТРОВ: строки = SupplierAdapterRegistry ∪
 * FlightSupplierRegistry, колонки = производная serviceTypes (+ flights).
 * Тесты доказывают: новый supplier/service попадает в матрицу БЕЗ изменения
 * кода; пары вне поддержки не появляются; NOT_CONFIGURED = 0% отличим от
 * CONFIGURED; Decimal сериализуется строкой; resolve получает instant.
 */
import { Prisma } from "../../generated/prisma/client";
import { MarkupMatrixService } from "./markup-matrix.service";
import type { SupplierPricingService, ResolvedMarkup } from "./supplier-pricing.service";
import type { SupplierAdapterRegistry } from "../supplier/adapter/supplier-adapter.registry";
import type { FlightSupplierRegistry } from "../supplier/flight-supplier.registry";

const NOT_CONFIGURED: ResolvedMarkup = {
  state: "NOT_CONFIGURED",
  rate: new Prisma.Decimal(0),
  ruleCode: null,
  ruleVersion: null,
};

function adapterEntry(code: string, name: string, serviceTypes?: string[], enabled = true) {
  return {
    adapter: { code, name, enabled },
    config: serviceTypes === undefined ? {} : { serviceTypes },
  };
}

interface MatrixDeps {
  matrix: MarkupMatrixService;
  resolve: jest.Mock;
  adapters: ReturnType<typeof adapterEntry>[];
  flightCodes: string[];
  flightNames: Record<string, string>;
}

function makeService(
  adapters: ReturnType<typeof adapterEntry>[],
  flightCodes: string[],
  flightNames: Record<string, string> = {},
  rules: Record<string, ResolvedMarkup> = {},
): MatrixDeps {
  const resolve = jest.fn(async (code: string, serviceType: string, at: Date) => {
    const rule = rules[`${code}/${serviceType}`];
    if (rule) return rule;
    return { ...NOT_CONFIGURED };
  });
  const registry = { getEntries: () => adapters } as unknown as SupplierAdapterRegistry;
  const flights = {
    list: () => flightCodes,
    get: (code: string) => ({ code, name: flightNames[code] ?? code }),
  } as unknown as FlightSupplierRegistry;
  const pricing = { resolve } as unknown as SupplierPricingService;
  return { matrix: new MarkupMatrixService(pricing, registry, flights), resolve, adapters, flightCodes, flightNames };
}

describe("MarkupMatrixService (§4.1)", () => {
  it("builds rows/columns from registries — no hardcoded supplier or service lists (Gate A)", async () => {
    const svc = makeService(
      [
        adapterEntry("ANEX", "ANEX", ["tours"]),
        adapterEntry("ANEX", "ANEX", ["hotels"]),
        adapterEntry("KOMPAS", "Kompas Tour", ["tours"]),
      ],
      ["AZAL", "AVIASALES"],
      { AZAL: "AZAL", AVIASALES: "Aviasales" },
    );

    const matrix = await svc.matrix.build(new Date("2026-10-01T12:00:00.000Z"));

    expect(matrix.services).toEqual(["flights", "hotels", "tours"]);
    expect(matrix.suppliers.map((s) => s.code)).toEqual(["ANEX", "AVIASALES", "AZAL", "KOMPAS"]);
    expect(matrix.suppliers.find((s) => s.code === "ANEX")).toMatchObject({ name: "ANEX", enabled: true });
    expect(matrix.suppliers.find((s) => s.code === "AVIASALES")).toMatchObject({ name: "Aviasales" });
    expect(matrix.at).toBe("2026-10-01T12:00:00.000Z");
  });

  it("includes a NEW supplier registered by registry only — no matrix code change (Gate A)", async () => {
    const svc = makeService(
      [adapterEntry("KOMPAS", "Kompas Tour", ["tours"]), adapterEntry("NEWSUP", "New Supplier", ["tours", "hotels"])],
      [],
    );

    const matrix = await svc.matrix.build();

    expect(matrix.suppliers.map((s) => s.code)).toEqual(["KOMPAS", "NEWSUP"]);
    expect(matrix.cells.filter((c) => c.supplierCode === "NEWSUP").map((c) => c.serviceType)).toEqual([
      "hotels",
      "tours",
    ]);
  });

  it("emits cells ONLY for supported supplier×service pairs", async () => {
    const svc = makeService(
      [
        adapterEntry("ANEX", "ANEX", ["tours"]),
        adapterEntry("ANEX", "ANEX", ["hotels"]),
        adapterEntry("KOMPAS", "Kompas Tour", ["tours"]),
      ],
      ["AZAL"],
    );

    const matrix = await svc.matrix.build();

    const pairs = matrix.cells.map((c) => `${c.supplierCode}/${c.serviceType}`);
    expect(pairs).toEqual(["ANEX/hotels", "ANEX/tours", "AZAL/flights", "KOMPAS/tours"]);
    expect(pairs).not.toContain("KOMPAS/hotels");
    expect(pairs).not.toContain("ANEX/flights");
    expect(pairs).not.toContain("AZAL/tours");
  });

  it("distinguishes NOT_CONFIGURED (rate \"0\") from CONFIGURED rule cells", async () => {
    const configured: ResolvedMarkup = {
      state: "CONFIGURED",
      rate: new Prisma.Decimal("0.075"),
      ruleCode: "MK-ANEX-TOURS",
      ruleVersion: 3,
    };
    const svc = makeService(
      [adapterEntry("ANEX", "ANEX", ["tours"]), adapterEntry("KOMPAS", "Kompas Tour", ["tours"])],
      [],
      {},
      { "ANEX/tours": configured },
    );

    const matrix = await svc.matrix.build();

    const anex = matrix.cells.find((c) => c.supplierCode === "ANEX" && c.serviceType === "tours");
    expect(anex).toEqual({
      supplierCode: "ANEX",
      serviceType: "tours",
      state: "CONFIGURED",
      rate: "0.075",
      ruleCode: "MK-ANEX-TOURS",
      ruleVersion: 3,
    });
    const kompas = matrix.cells.find((c) => c.supplierCode === "KOMPAS");
    expect(kompas).toEqual({
      supplierCode: "KOMPAS",
      serviceType: "tours",
      state: "NOT_CONFIGURED",
      rate: "0",
      ruleCode: null,
      ruleVersion: null,
    });
  });

  it("resolves every cell at the requested business instant", async () => {
    const at = new Date("2026-11-05T00:00:00.000Z");
    const svc = makeService([adapterEntry("KOMPAS", "Kompas Tour", ["tours"])], ["AZAL"]);

    await svc.matrix.build(at);

    expect(svc.resolve).toHaveBeenCalledTimes(2);
    for (const call of svc.resolve.mock.calls) {
      expect(call[2]).toBe(at);
    }
    expect(svc.resolve).toHaveBeenCalledWith("KOMPAS", "tours", at);
    expect(svc.resolve).toHaveBeenCalledWith("AZAL", "flights", at);
  });

  it("legacy wildcard registration (no serviceTypes) supports every derived service", async () => {
    const svc = makeService([adapterEntry("LEGACY", "Legacy"), adapterEntry("ANEX", "ANEX", ["tours"])], ["AZAL"]);

    const matrix = await svc.matrix.build();

    // Колонки производные: tours (ANEX) + flights (реестр); «hotels» нигде
    // не объявлена → wildcard получает только реально выведенные сервисы.
    expect(matrix.services).toEqual(["flights", "tours"]);
    expect(matrix.cells.filter((c) => c.supplierCode === "LEGACY").map((c) => c.serviceType)).toEqual([
      "flights",
      "tours",
    ]);
    expect(matrix.cells.filter((c) => c.supplierCode === "ANEX").map((c) => c.serviceType)).toEqual(["tours"]);
  });

  it("merges one supplier row across per-category registrations (Provider → Category-Adapter)", async () => {
    const svc = makeService(
      [adapterEntry("ANEX", "ANEX", ["tours"]), adapterEntry("ANEX", "ANEX", ["hotels"])],
      [],
    );

    const matrix = await svc.matrix.build();

    expect(matrix.suppliers.filter((s) => s.code === "ANEX")).toHaveLength(1);
    expect(matrix.cells.filter((c) => c.supplierCode === "ANEX")).toHaveLength(2);
  });

  it("disabled adapter row stays visible with enabled=false (admin sees it)", async () => {
    const svc = makeService([adapterEntry("OLD", "Old Supplier", ["tours"], false)], []);

    const matrix = await svc.matrix.build();

    expect(matrix.suppliers).toEqual([{ code: "OLD", name: "Old Supplier", enabled: false }]);
  });
});
