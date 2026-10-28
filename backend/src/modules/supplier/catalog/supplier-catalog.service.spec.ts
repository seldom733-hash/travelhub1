import { SupplierCatalogService } from "./supplier-catalog.service";
import type { CatalogRecord } from "./supplier-catalog.types";

function record(overrides: Partial<CatalogRecord> = {}): CatalogRecord {
  return {
    supplierCode: "ANEX",
    serviceType: "tours",
    externalKey: "ANEX-100",
    productType: "TOUR",
    categorySlug: "tours",
    title: "Hotel (Türkiye)",
    countryCode: "TR",
    stateCode: "TR",
    hotelKey: "100",
    hotelName: "Hotel",
    attributes: { hotelName: "Hotel", hotelKey: "100", countryCode: "TR" },
    startingPrice: 100,
    currency: "AZN",
    tariffs: [{ name: "Base", amount: 100, currency: "AZN" }],
    ...overrides,
  };
}

function makeService(overrides: {
  products?: unknown[];
  candidates?: unknown[];
  identities?: unknown[];
} = {}) {
  const prisma = {
    product: {
      findMany: jest.fn()
        .mockResolvedValueOnce(overrides.products ?? [])
        .mockResolvedValueOnce(overrides.candidates ?? []),
    },
    supplierCatalogIdentity: {
      findMany: jest.fn().mockResolvedValue(overrides.identities ?? []),
    },
  };
  const source = {} as never;
  const ids = {} as never;
  return {
    service: new SupplierCatalogService(prisma as never, ids, source),
    prisma,
  };
}

describe("SupplierCatalogService.buildPlan", () => {
  it("creates an exact supplierRef that does not exist", async () => {
    const { service } = makeService();
    const plan = await (service as any).buildPlan([record()], false, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].action).toBe("CREATE");
    expect(plan.items[0].after.externalKey).toBe("ANEX-100");
  });

  it("updates an existing active product", async () => {
    const { service } = makeService({
      products: [{ id: "p1", supplierRef: "ANEX-100", status: "PUBLISHED", version: 2, code: "PRD-1", title: "Old", type: "TOUR", attributes: {} }],
    });
    const plan = await (service as any).buildPlan([record()], false, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items[0]).toMatchObject({ productId: "p1", action: "UPDATE" });
  });

  it("restores archived only when the new mechanism recorded archive run", async () => {
    const product = { id: "p1", supplierRef: "ANEX-100", status: "ARCHIVED", version: 3, code: "PRD-1", title: "Old", type: "TOUR", attributes: {} };
    const { service } = makeService({
      products: [product],
      identities: [{ externalKey: "ANEX-100", status: "ARCHIVED", archivedByRunId: "run-1" }],
    });
    const plan = await (service as any).buildPlan([record()], false, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items[0].action).toBe("RESTORE");
  });

  it("requires manual review for legacy archived cards", async () => {
    const { service } = makeService({
      products: [{ id: "p1", supplierRef: "ANEX-100", status: "ARCHIVED", version: 3, code: "PRD-1", title: "Old", type: "TOUR", attributes: {} }],
      identities: [],
    });
    const plan = await (service as any).buildPlan([record()], false, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items[0].action).toBe("LEGACY_ARCHIVED");
    expect(plan.items[0].reason).toContain("manual review");
  });

  it("archives a missing in-scope product only when coverage is complete", async () => {
    const { service } = makeService({
      products: [],
      candidates: [{
        id: "p2",
        supplierRef: "ANEX-OLD",
        title: "Gone",
        code: "PRD-2",
        attributes: { countryCode: "TR" },
      }],
    });
    const plan = await (service as any).buildPlan([record()], true, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items.some((item: any) => item.action === "ARCHIVE" && item.productId === "p2")).toBe(true);
  });

  it("never archives when coverage is partial", async () => {
    const { service } = makeService({
      products: [],
      candidates: [{
        id: "p2",
        supplierRef: "ANEX-OLD",
        title: "Gone",
        code: "PRD-2",
        attributes: { countryCode: "TR" },
      }],
    });
    const plan = await (service as any).buildPlan([record()], false, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items.some((item: any) => item.action === "ARCHIVE")).toBe(false);
  });

  it("never archives a card from another country even on a complete preview", async () => {
    const { service } = makeService({
      products: [],
      candidates: [{
        id: "p-other-country",
        supplierRef: "ANEX-OLD",
        title: "Turkey card",
        code: "PRD-3",
        attributes: { countryCode: "TR" },
      }],
    });
    const plan = await (service as any).buildPlan([record()], true, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "AT",
    });
    expect(plan.items.some((item: any) => item.action === "ARCHIVE")).toBe(false);
  });

  it("skips records without a positive price instead of publishing zero", async () => {
    const { service } = makeService();
    const plan = await (service as any).buildPlan([record({ startingPrice: 0, tariffs: [] })], false, {
      supplierCode: "ANEX", serviceType: "tours", countryKey: "TR",
    });
    expect(plan.items[0].action).toBe("ERROR");
    expect(plan.items[0].error).toContain("positive price");
  });

  it("discovers both services before building an ALL preview scope", async () => {
    const prisma = {
      supplierCatalogCountry: { findMany: jest.fn().mockResolvedValue([]) },
      partner: {
        findMany: jest.fn().mockResolvedValue([{ name: "Voyager", status: "ACTIVE" }]),
        findFirst: jest.fn().mockResolvedValue({ status: "ACTIVE" }),
      },
      supplierCatalogRun: {
        create: jest.fn().mockResolvedValue({ id: "run-1" }),
        findUnique: jest.fn().mockResolvedValue({ id: "run-1", items: [] }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const source = {
      capabilities: jest.fn().mockResolvedValue([
        { supplierCode: "VOYAGER", name: "Voyager", serviceTypes: ["tours"], countries: [{ key: "TH", label: "Таиланд" }] },
        { supplierCode: "VOYAGER", name: "Voyager", serviceTypes: ["hotels"], countries: [{ key: "TH", label: "Таиланд" }] },
      ]),
    };
    const service = new SupplierCatalogService(prisma as never, {} as never, source as never);
    const discover = jest.spyOn(service, "discoverCountries").mockResolvedValue({
      discovered: 0, skipped: 0, countries: [],
    } as never);
    jest.spyOn(service as any, "executePreview").mockResolvedValue(undefined);

    await service.startPreview(
      { id: "u1", username: "admin" },
      { supplierCode: "VOYAGER", serviceType: "all", countryKey: "ALL" },
    );

    expect(discover).toHaveBeenNthCalledWith(1, { id: "u1", username: "admin" }, {
      supplierCode: "VOYAGER", serviceType: "tours",
    });
    expect(discover).toHaveBeenNthCalledWith(2, { id: "u1", username: "admin" }, {
      supplierCode: "VOYAGER", serviceType: "hotels",
    });
  });

  it("blocks a country that was already fully synced today", async () => {
    const prisma = {
      supplierCatalogCountry: { findMany: jest.fn().mockResolvedValue([]) },
      partner: {
        findMany: jest.fn().mockResolvedValue([{ name: "Voyager", status: "ACTIVE" }]),
        findFirst: jest.fn().mockResolvedValue({ status: "ACTIVE" }),
      },
      supplierCatalogRun: {
        findMany: jest.fn().mockResolvedValue([
          { serviceType: "tours", countryCode: "TR", scope: null },
        ]),
      },
    };
    const source = {
      capabilities: jest.fn().mockResolvedValue([
        { supplierCode: "VOYAGER", name: "Voyager", serviceTypes: ["tours"], countries: [{ key: "TR", label: "Türkiye" }] },
      ]),
    };
    const service = new SupplierCatalogService(prisma as never, {} as never, source as never);
    await expect(service.startPreview(
      { id: "u1", username: "admin" },
      { supplierCode: "VOYAGER", serviceType: "tours", countryKey: "TR" },
    )).rejects.toThrow(/уже полностью загружены/);
  });

  it("merges a persisted discovered country into capabilities", async () => {
    const prisma = {
      supplierCatalogCountry: {
        findMany: jest.fn().mockResolvedValue([
          { supplierCode: "VOYAGER", serviceType: "tours", countryKey: "JP", countryLabel: "Япония" },
        ]),
      },
      partner: {
        findMany: jest.fn().mockResolvedValue([{ name: "Voyager", status: "ACTIVE" }]),
      },
    };
    const source = {
      capabilities: jest.fn().mockResolvedValue([
        { supplierCode: "VOYAGER", name: "Voyager", serviceTypes: ["tours"], countries: [{ key: "TH", label: "Таиланд" }] },
      ]),
    };
    const service = new SupplierCatalogService(prisma as never, {} as never, source as never);
    const caps = await service.activeCapabilities();
    expect(caps[0].countries).toEqual(expect.arrayContaining([
      { key: "TH", label: "Таиланд" },
      { key: "JP", label: "Япония" },
    ]));
  });
});
