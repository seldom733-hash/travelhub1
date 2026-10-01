import { RoleCode } from "../../../generated/prisma/enums";
import { ForbiddenException } from "@nestjs/common";
import { TourBuilderService } from "./tour-builder.service";
import { CatalogAccessPolicy } from "../catalog-access.policy";
import { ConflictError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { IdsService } from "../../../shared/ids.service";
import type { SecurityService } from "../../../security/security.service";

const PARTNER: AuthUser = {
  id: "u-partner",
  code: "USR-00000001",
  username: "partner1",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.PARTNER,
  roleTitle: "Партнёр",
  partnerId: "P1",
  customerId: null,
  permissions: ["catalog.product.read_own", "catalog.product.update_own_draft", "catalog.dictionary.propose"],
} as AuthUser;

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    product: { findUnique: jest.fn(), update: jest.fn() },
    tariff: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    commercialPeriod: { update: jest.fn(), updateMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    availability: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    serviceUnit: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), delete: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    roomType: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    viewType: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    mealType: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    placementType: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  Object.assign(prisma, overrides);
  return prisma;
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  const ids = { nextCode: jest.fn(async (_tx: unknown, prefix: string) => `${prefix}-00000001`) } as unknown as IdsService;
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  const service = new TourBuilderService(prisma as unknown as PrismaService, ids, security, new CatalogAccessPolicy());
  return { service, security };
}

const BUILDER_PRODUCT = {
  id: "prod-1",
  code: "PRD-00000001",
  title: "Тур",
  type: "TOUR",
  status: "DRAFT",
  partnerId: "P1",
  attributes: {
    tourBuilder: { packageKind: "PACKAGE", components: [{ componentId: "UNI-1", kind: "accommodation", required: true }] },
  },
};

describe("TourBuilderService — календарь (слои kind/dayOfWeek)", () => {
  it("saveAccommodationCalendar: сохраняет PERIOD с dayOfWeek и DATE_OVERRIDE без него", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.tariff.findFirst.mockResolvedValue({ id: "TRF-1", productId: "prod-1", serviceUnitId: "UNI-1" });
    prisma.tariff.findMany.mockResolvedValue([{ id: "TRF-1" }]);
    const { service } = makeService(prisma);

    await service.saveAccommodationCalendar(
      "prod-1",
      "UNI-1",
      {
        tariffId: "TRF-1",
        periods: [
          { startDate: "2026-07-01", endDate: "2026-08-31", price: 100, kind: "PERIOD", dayOfWeek: [5, 6, 0, 5] },
          { startDate: "2026-09-01", endDate: "2026-09-01", price: 250, kind: "DATE_OVERRIDE" },
        ],
        allotment: [{ date: "2026-07-01", rooms: 3 }],
      },
      PARTNER,
    );

    const created = prisma.commercialPeriod.create.mock.calls.map((c: any[]) => c[0].data);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ kind: "PERIOD", dayOfWeek: [0, 5, 6] });
    expect(created[1]).toMatchObject({ kind: "DATE_OVERRIDE", dayOfWeek: [] });
    expect(prisma.commercialPeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tariffId: "TRF-1", status: "ACTIVE" }, data: { status: "ARCHIVED" } }),
    );
  });

  it("saveAccommodationCalendar: пустой periods без clearPeriods → no-op (слои не стираются), квота пишется", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.tariff.findFirst.mockResolvedValue({ id: "TRF-1", productId: "prod-1", serviceUnitId: "UNI-1" });
    prisma.tariff.findMany.mockResolvedValue([{ id: "TRF-1" }, { id: "TRF-2" }]);
    const { service } = makeService(prisma);

    // Сохранение квоты: клиент прислал periods=[] (не знал/не трогал слои).
    await service.saveAccommodationCalendar(
      "prod-1",
      "UNI-1",
      { tariffId: "TRF-1", periods: [], allotment: [{ date: "2026-07-01", rooms: 5 }] },
      PARTNER,
    );

    expect(prisma.commercialPeriod.updateMany).not.toHaveBeenCalled();
    expect(prisma.commercialPeriod.create).not.toHaveBeenCalled();
    // Квота при этом синхронизирована на все тарифы юнита.
    const createdQuota = prisma.availability.create.mock.calls.map((c: any[]) => c[0].data.tariffId);
    expect(createdQuota).toEqual(["TRF-1", "TRF-2"]);
  });

  it("saveAccommodationCalendar: clearPeriods=true + пустой periods → слои архивируются", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.tariff.findFirst.mockResolvedValue({ id: "TRF-1", productId: "prod-1", serviceUnitId: "UNI-1" });
    prisma.tariff.findMany.mockResolvedValue([{ id: "TRF-1" }]);
    const { service } = makeService(prisma);

    await service.saveAccommodationCalendar(
      "prod-1",
      "UNI-1",
      { tariffId: "TRF-1", periods: [], clearPeriods: true, allotment: [] },
      PARTNER,
    );

    expect(prisma.commercialPeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tariffId: "TRF-1", status: "ACTIVE" }, data: { status: "ARCHIVED" } }),
    );
    expect(prisma.commercialPeriod.create).not.toHaveBeenCalled();
  });

  it("saveAccommodationCalendar: same-priority overlap → 422", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    const { service } = makeService(prisma);

    // Оба PERIOD без dayOfWeek и с одинаковой длиной (31 день) при пересечении —
    // недетерминированный выбор цены (DD-026 §3.6).
    await expect(
      service.saveAccommodationCalendar(
        "prod-1",
        "UNI-1",
        {
          tariffId: "TRF-1",
          periods: [
            { startDate: "2026-07-01", endDate: "2026-07-31", price: 100 },
            { startDate: "2026-07-15", endDate: "2026-08-14", price: 130 },
          ],
          allotment: [],
        },
        PARTNER,
      ),
    ).rejects.toThrow(ValidationDomainError);
  });

  it("saveAccommodationCalendar: квота синхронизируется на ВСЕ тарифы юнита", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.tariff.findFirst.mockResolvedValue({ id: "TRF-1", productId: "prod-1", serviceUnitId: "UNI-1" });
    prisma.tariff.findMany.mockResolvedValue([{ id: "TRF-1" }, { id: "TRF-2" }, { id: "TRF-3" }]);
    const { service } = makeService(prisma);

    await service.saveAccommodationCalendar(
      "prod-1",
      "UNI-1",
      { tariffId: "TRF-1", periods: [], allotment: [{ date: "2026-07-01", rooms: 5 }] },
      PARTNER,
    );

    const createdTariffs = prisma.availability.create.mock.calls.map((c: any[]) => c[0].data.tariffId);
    expect(createdTariffs).toEqual(["TRF-1", "TRF-2", "TRF-3"]);
  });
});

describe("TourBuilderService — варианты проживания", () => {
  it("createVariant: неизвестный код фасеты → 422", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.viewType.findFirst.mockResolvedValue(null);
    const { service } = makeService(prisma);

    await expect(
      service.createVariant("prod-1", "UNI-1", { viewCode: "NOPE", mealCode: "BB", placementCode: "DBL" }, PARTNER),
    ).rejects.toThrow(ValidationDomainError);
  });

  it("createVariant: ACTIVE коды → тариф с inclusions-фасетами", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.viewType.findFirst.mockResolvedValue({ id: "v1", code: "SEA" });
    prisma.mealType.findFirst.mockResolvedValue({ id: "m1", code: "BB" });
    prisma.placementType.findFirst.mockResolvedValue({ id: "p1", code: "DBL" });
    prisma.tariff.create.mockImplementation(async (args: any) => ({ id: "TRF-9", ...args.data }));
    const { service } = makeService(prisma);

    const tariff = await service.createVariant(
      "prod-1",
      "UNI-1",
      { viewCode: "SEA", mealCode: "BB", placementCode: "DBL", basePrice: 120 },
      PARTNER,
    );

    expect(tariff.inclusions).toEqual({ mealCode: "BB", placementCode: "DBL", viewCode: "SEA" });
    expect(tariff.price).toBeDefined();
    expect(prisma.tariff.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ serviceUnitId: "UNI-1", productId: "prod-1" }) }),
    );
  });

  it("createVariant: extraBed/extraSofa → булевы inclusions + маркеры в авто-имени", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.mealType.findFirst.mockResolvedValue({ id: "m1", code: "BB" });
    prisma.placementType.findFirst.mockResolvedValue({ id: "p1", code: "DBL" });
    prisma.tariff.create.mockImplementation(async (args: any) => ({ id: "TRF-9", ...args.data }));
    const { service } = makeService(prisma);

    const tariff = await service.createVariant(
      "prod-1",
      "UNI-1",
      { mealCode: "BB", placementCode: "DBL", extraBed: true, extraSofa: true, basePrice: 100 },
      PARTNER,
    );

    expect(tariff.inclusions).toEqual({ mealCode: "BB", placementCode: "DBL", extraBed: true, extraSofa: true });
    expect(tariff.name).toBe("DBL BB Ext.Bed Ext.Sofa");
  });

  it("updateVariant: флаги ставятся/снимаются, без флагов inclusions не трогаются", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.mealType.findFirst.mockResolvedValue({ id: "m1", code: "BB" });
    prisma.placementType.findFirst.mockResolvedValue({ id: "p1", code: "DBL" });
    prisma.tariff.findFirst.mockResolvedValue({
      id: "TRF-1", productId: "prod-1", serviceUnitId: "UNI-1", name: "DBL BB",
      inclusions: { mealCode: "BB", placementCode: "DBL", extraBed: true },
    });
    prisma.tariff.update.mockImplementation(async (args: any) => ({ id: "TRF-1", ...args.data }));
    const { service } = makeService(prisma);

    await service.updateVariant("prod-1", "UNI-1", "TRF-1", { extraBed: false, extraSofa: true }, PARTNER);
    expect(prisma.tariff.update.mock.calls[0][0].data.inclusions).toEqual({ mealCode: "BB", placementCode: "DBL", extraSofa: true });

    await service.updateVariant("prod-1", "UNI-1", "TRF-1", { mealCode: "BB" }, PARTNER);
    expect(prisma.tariff.update.mock.calls[1][0].data.inclusions).toEqual({ mealCode: "BB", placementCode: "DBL", extraBed: true });
  });

  it("removeVariant: последний активный вариант удалить нельзя → 409", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.tariff.findFirst.mockResolvedValue({ id: "TRF-1", productId: "prod-1", serviceUnitId: "UNI-1" });
    prisma.tariff.count.mockResolvedValue(1);
    const { service } = makeService(prisma);

    await expect(service.removeVariant("prod-1", "UNI-1", "TRF-1", PARTNER)).rejects.toThrow(ConflictError);
  });

  it("removeComponent: чистит квоты/периоды/тарифы юнита", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    prisma.serviceUnit.findUnique.mockResolvedValue({ id: "UNI-1", attributes: {}, tariffs: [{ id: "TRF-1" }, { id: "TRF-2" }] });
    const { service, security } = makeService(prisma);

    const res = await service.removeComponent("prod-1", "UNI-1", PARTNER);

    expect(res).toEqual({ ok: true });
    expect(prisma.availability.deleteMany).toHaveBeenCalled();
    expect(prisma.commercialPeriod.deleteMany).toHaveBeenCalledWith({ where: { tariffId: { in: ["TRF-1", "TRF-2"] } } });
    expect(prisma.tariff.deleteMany).toHaveBeenCalled();
    expect(security.audit).toHaveBeenCalled();
  });
});

describe("TourBuilderService — quote: альтернативы вариантов", () => {
  it("выбирает дешёвый вариант (rooms по capacity), остальные — в alternatives", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [
        {
          id: "UNI-1",
          name: "Проживание",
          attributes: { tourBuilderKind: "accommodation", payload: { mealSupplements: { BB: 5 } } },
          tariffs: [
            {
              id: "TRF-DBL",
              code: "TRF-1",
              name: "DBL SEA BB",
              price: { toNumber: () => 100 },
              currency: "USD",
              inclusions: { mealCode: "BB", placementCode: "DBL", viewCode: "SEA" },
              periods: [],
            },
            {
              id: "TRF-TRPL",
              code: "TRF-2",
              name: "TRPL BB",
              price: { toNumber: () => 120 },
              currency: "USD",
              inclusions: { mealCode: "BB", placementCode: "TRPL" },
              periods: [],
            },
          ],
        },
      ],
    });
    const { service } = makeService(prisma);

    // 2 взрослых + 1 ребёнок = 3 гостя: DBL → 2 номера (100×2=200+питание),
    // TRPL → 1 номер (120+питание) → дешевле TRPL.
    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 1, adults: 2, children: [{ age: 5 }] }, PARTNER);

    const line = quote.lines[0] as any;
    expect(line.variant.placementCode).toBe("TRPL");
    expect(line.variant.rooms).toBe(1);
    // 120 (ночь) + BB 5×1 ночь×2 взр = 130
    expect(line.amount).toBe(130);
    expect(line.alternatives).toHaveLength(1);
    expect(line.alternatives[0].placementCode).toBe("DBL");
    // DBL: 100×2 номера + 5×2 = 210
    expect(line.alternatives[0].amount).toBe(210);
    expect(quote.totals.net).toBe(130);
  });

  it("legacy-тариф без фасет: capacity 2 и сумма всех mealSupplements", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [
        {
          id: "UNI-1",
          name: "Проживание",
          attributes: { tourBuilderKind: "accommodation", payload: { mealSupplements: { BB: 10, HB: 20 } } },
          tariffs: [{ id: "TRF-1", code: "TRF-1", name: "base", price: { toNumber: () => 100 }, currency: "USD", inclusions: null, periods: [] }],
        },
      ],
    });
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 2, adults: 2, children: [] }, PARTNER);

    const line = quote.lines[0] as any;
    // 2 гостя → 1 номер (cap 2): 100×2 ночи = 200 + (10+20)×2×2 = 120 → 320
    expect(line.amount).toBe(320);
    expect(quote.lines).toHaveLength(1);
  });

  it("отсутствует тариф → warning и компонент пропущен", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [{ id: "UNI-1", name: "Проживание", attributes: { tourBuilderKind: "accommodation", payload: {} }, tariffs: [] }],
    });
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 1, adults: 2, children: [] }, PARTNER);

    expect(quote.lines).toHaveLength(0);
    expect(quote.warnings.join(" ")).toContain("нет Rate Plan");
    expect(quote.totals.net).toBe(0);
  });

  it("квота: нет строк Availability → available null (NOT_CONFIGURED), не 0", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [
        {
          id: "UNI-1",
          name: "Проживание",
          attributes: { tourBuilderKind: "accommodation", payload: {} },
          tariffs: [{ id: "TRF-1", code: "TRF-1", name: "base", price: { toNumber: () => 100 }, currency: "USD", inclusions: null, periods: [] }],
        },
      ],
    });
    prisma.availability.findMany.mockResolvedValue([]);
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 2, adults: 2, children: [] }, PARTNER);

    expect(quote.availability.perComponent[0].available).toBeNull();
    expect(quote.availability.bottleneck).toBeNull();
  });

  it("квота: есть строки не на все ночи → available null (NOT_CONFIGURED), не минимум по известным", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [
        {
          id: "UNI-1",
          name: "Проживание",
          attributes: { tourBuilderKind: "accommodation", payload: {} },
          tariffs: [{ id: "TRF-1", code: "TRF-1", name: "base", price: { toNumber: () => 100 }, currency: "USD", inclusions: null, periods: [] }],
        },
      ],
    });
    // Только первая ночь настроена (3 номера), вторая — без строки.
    prisma.availability.findMany.mockResolvedValue([
      { tariffId: "TRF-1", date: new Date("2026-07-01T00:00:00.000Z"), slotsTotal: 3, slotsBooked: 1, slotsReserved: 0 },
    ]);
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 2, adults: 2, children: [] }, PARTNER);

    expect(quote.availability.perComponent[0].available).toBeNull();
    expect(quote.availability.bottleneck).toBeNull();
  });

  it("квота: строки на все ночи → available = минимум свободных", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [
        {
          id: "UNI-1",
          name: "Проживание",
          attributes: { tourBuilderKind: "accommodation", payload: {} },
          tariffs: [{ id: "TRF-1", code: "TRF-1", name: "base", price: { toNumber: () => 100 }, currency: "USD", inclusions: null, periods: [] }],
        },
      ],
    });
    prisma.availability.findMany.mockResolvedValue([
      { tariffId: "TRF-1", date: new Date("2026-07-01T00:00:00.000Z"), slotsTotal: 5, slotsBooked: 1, slotsReserved: 0 },
      { tariffId: "TRF-1", date: new Date("2026-07-02T00:00:00.000Z"), slotsTotal: 4, slotsBooked: 2, slotsReserved: 1 },
    ]);
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 2, adults: 2, children: [] }, PARTNER);

    // ночь1: 5-1=4, ночь2: 4-2-1=1 → min = 1
    expect(quote.availability.perComponent[0].available).toBe(1);
    expect(quote.availability.bottleneck?.available).toBe(1);
  });

  it("placementCode TWIN → capacity 2 (rooms = ceil(гостей/2))", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      title: "Тур",
      partnerId: "P1",
      attributes: structuredClone(BUILDER_PRODUCT.attributes),
      serviceUnits: [
        {
          id: "UNI-1",
          name: "Проживание",
          attributes: { tourBuilderKind: "accommodation", payload: { mealSupplements: {} } },
          tariffs: [
            {
              id: "TRF-1", code: "TRF-1", name: "TWIN BB",
              price: { toNumber: () => 100 }, currency: "USD",
              inclusions: { mealCode: "BB", placementCode: "TWIN" },
              periods: [],
            },
          ],
        },
      ],
    });
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 1, adults: 3, children: [] }, PARTNER);

    const line = quote.lines[0] as any;
    expect(line.variant.capacity).toBe(2);
    expect(line.variant.rooms).toBe(2); // ceil(3/2)
    expect(line.amount).toBe(200); // 100×2 номера
  });
});

describe("TourBuilderService — quote: доп. опции Ext.Bed/Ext.Sofa", () => {
  const EXT_PRODUCT = {
    id: "prod-1",
    code: "PRD-00000001",
    title: "Тур",
    partnerId: "P1",
    attributes: {
      tourBuilder: {
        packageKind: "PACKAGE",
        components: [{ componentId: "UNI-1", kind: "accommodation", required: true }],
        extraBedPrice: 10,
        extraSofaPrice: 0,
      },
    },
    serviceUnits: [
      {
        id: "UNI-1",
        name: "Проживание",
        attributes: { tourBuilderKind: "accommodation", payload: { mealSupplements: { BB: 5 } } },
        tariffs: [
          {
            id: "TRF-EXT", code: "TRF-1", name: "DBL BB Ext.Bed Ext.Sofa",
            price: { toNumber: () => 100 }, currency: "USD",
            inclusions: { mealCode: "BB", placementCode: "DBL", extraBed: true, extraSofa: true },
            periods: [],
          },
          {
            id: "TRF-PLAIN", code: "TRF-2", name: "DBL BB",
            price: { toNumber: () => 120 }, currency: "USD",
            inclusions: { mealCode: "BB", placementCode: "DBL" },
            periods: [],
          },
        ],
      },
    ],
  };

  it("платный Ext.Bed добавляет надбавку с формулой, бесплатный Ext.Sofa — только формула", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(EXT_PRODUCT);
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 2, adults: 2, children: [] }, PARTNER);

    const line = quote.lines[0] as any;
    // EXT: 100×2 ночи + питание 5×2×2 + Ext.Bed 10×2×1 = 200+20+20 = 240
    expect(line.amount).toBe(240);
    expect(line.formulas.join("\n")).toContain("Ext. Bed: +10/сут × 2 ноч. × 1 номер(ов) = 20");
    expect(line.formulas.join("\n")).toContain("Ext. Sofa: бесплатно");
    expect(line.variant.extraBed).toBe(true);
    expect(line.variant.extraSofa).toBe(true);
    // Альтернатива без флагов: 120×2 + 20 = 260
    expect(line.alternatives[0].amount).toBe(260);
    expect(line.alternatives[0].extraBed).toBe(false);
    expect(line.alternatives[0].extraSofa).toBe(false);
    expect(quote.totals.net).toBe(240);
  });

  it("цена доп.опции не задана → 0 = бесплатно (надбавки нет)", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      ...EXT_PRODUCT,
      attributes: {
        tourBuilder: { packageKind: "PACKAGE", components: [{ componentId: "UNI-1", kind: "accommodation", required: true }] },
      },
    });
    const { service } = makeService(prisma);

    const quote = await service.quote("prod-1", { departureDate: "2026-07-01", nights: 2, adults: 2, children: [] }, PARTNER);

    const line = quote.lines[0] as any;
    expect(line.amount).toBe(220); // 100×2 + питание 20, без надбавок
    expect(line.formulas.join("\n")).toContain("Ext. Bed: бесплатно");
    expect(line.formulas.join("\n")).toContain("Ext. Sofa: бесплатно");
  });
});

describe("TourBuilderService — правила пакета (цены доп. опций)", () => {
  it("extraBedPrice/extraSofaPrice сохраняются в атрибутах продукта", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    const { service } = makeService(prisma);

    await service.setPackageRules("prod-1", { extraBedPrice: 15, extraSofaPrice: 0 }, PARTNER);

    const written = prisma.product.update.mock.calls[0][0].data.attributes.tourBuilder;
    expect(written.extraBedPrice).toBe(15);
    expect(written.extraSofaPrice).toBe(0);
  });

  it("undefined = поле не трогается (старые вызовы без новых полей)", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    const { service } = makeService(prisma);

    await service.setPackageRules("prod-1", { extraBedPrice: 15 }, PARTNER);
    // Второй вызов: возвращённый state содержит сохранённые цены.
    prisma.product.findUnique.mockResolvedValue({
      ...structuredClone(BUILDER_PRODUCT),
      attributes: {
        tourBuilder: { packageKind: "PACKAGE", components: [{ componentId: "UNI-1", kind: "accommodation", required: true }], extraBedPrice: 15, extraSofaPrice: 7 },
      },
    });
    await service.setPackageRules("prod-1", { extraBedPrice: 25 }, PARTNER);

    const written = prisma.product.update.mock.calls[1][0].data.attributes.tourBuilder;
    expect(written.extraBedPrice).toBe(25);
    expect(written.extraSofaPrice).toBe(7); // не затёрт
    expect(written.packageDiscountPct).toBeUndefined(); // не обнулён молча
  });

  it("babyCot: true/false пишется, undefined — не трогает", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(structuredClone(BUILDER_PRODUCT));
    const { service } = makeService(prisma);

    await service.setPackageRules("prod-1", { babyCot: true }, PARTNER);
    expect(prisma.product.update.mock.calls[0][0].data.attributes.tourBuilder.babyCot).toBe(true);

    prisma.product.findUnique.mockResolvedValue({
      ...structuredClone(BUILDER_PRODUCT),
      attributes: {
        tourBuilder: { packageKind: "PACKAGE", components: [{ componentId: "UNI-1", kind: "accommodation", required: true }], babyCot: true, extraBedPrice: 10 },
      },
    });
    await service.setPackageRules("prod-1", { extraSofaPrice: 3 }, PARTNER);
    const written = prisma.product.update.mock.calls[1][0].data.attributes.tourBuilder;
    expect(written.babyCot).toBe(true); // не сброшен
    expect(written.extraBedPrice).toBe(10);
    expect(written.extraSofaPrice).toBe(3);
  });
});

describe("TourBuilderService — валюта пакета (USD/EUR/AZN + курсы партнёра)", () => {
  function productWithCurrency() {
    return {
      ...structuredClone(BUILDER_PRODUCT),
      attributes: {
        tourBuilder: {
          packageKind: "PACKAGE",
          components: [{ componentId: "UNI-1", kind: "accommodation", required: true }],
          currency: "USD",
          fx: { usdAzn: 2, eurAzn: 1 },
          extraBedPrice: 10,
          grossOverride: { amount: 100, currency: "USD" },
        },
      },
    };
  }

  it("смена USD→EUR: тарифы/периоды/payload и доп.опции конвертируются по fx, валюта тарифов = EUR", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(productWithCurrency());
    prisma.tariff.findMany.mockResolvedValue([{ id: "TRF-1", price: 100 }]);
    prisma.commercialPeriod.findMany.mockResolvedValue([{ id: "CPR-1", price: 120 }]);
    prisma.serviceUnit.findMany.mockResolvedValue([
      { id: "UNI-1", attributes: { payload: { taxesPerPax: 50, childPct: 75, fareLadder: [{ upToSeat: 9, price: 300 }], durationBrackets: [{ bracket: "1-7", pricePerAdult: 40 }] } } },
      { id: "UNI-2", attributes: { payload: { vehicleType: "sedan", capacity: 4 } } },
    ]);
    const { service, security } = makeService(prisma);

    const res = await service.setPackageRules("prod-1", { currency: "EUR" }, PARTNER);

    // fx сохранён в атрибутах (usdAzn=2, eurAzn=1): factor = aznPer(EUR)/aznPer(USD) = 1/2 = 0.5
    expect(res).toMatchObject({ ok: true, converted: { from: "USD", to: "EUR", factor: 0.5 } });
    expect(prisma.tariff.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "TRF-1" }, data: { price: expect.anything(), currency: "EUR" } }));
    expect(prisma.tariff.update.mock.calls[0][0].data.price.toNumber()).toBe(50);
    expect(prisma.commercialPeriod.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "CPR-1" } }));
    expect(prisma.commercialPeriod.update.mock.calls[0][0].data.price.toNumber()).toBe(60);

    const unitUpdate = prisma.serviceUnit.update.mock.calls.find((c: any[]) => c[0].where.id === "UNI-1");
    const payload = unitUpdate![0].data.attributes.payload;
    expect(payload.taxesPerPax).toBe(25);
    expect(payload.fareLadder[0].price).toBe(150);
    expect(payload.durationBrackets[0].pricePerAdult).toBe(20);
    expect(payload.childPct).toBe(75); // проценты не трогаем
    // payload без денежных полей не трогается
    expect(prisma.serviceUnit.update.mock.calls.some((c: any[]) => c[0].where.id === "UNI-2")).toBe(false);

    const written = prisma.product.update.mock.calls.at(-1)![0].data.attributes.tourBuilder;
    expect(written.currency).toBe("EUR");
    expect(written.extraBedPrice).toBe(5); // 10 × 0.5
    expect(written.grossOverride).toEqual({ amount: 50, currency: "EUR" });
    const auditCalls = (security.audit as unknown as jest.Mock).mock.calls;
    expect(auditCalls.some((c: any[]) => c[1].action === "tour_builder.currency_changed")).toBe(true);
  });

  it("та же валюта или currency: undefined → без конвертации", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(productWithCurrency());
    const { service } = makeService(prisma);

    const same = await service.setPackageRules("prod-1", { currency: "USD" }, PARTNER);
    const none = await service.setPackageRules("prod-1", { packageDiscountPct: 5 }, PARTNER);

    expect(same).toEqual({ ok: true });
    expect(none).toEqual({ ok: true });
    expect(prisma.tariff.update).not.toHaveBeenCalled();
    expect(prisma.serviceUnit.update).not.toHaveBeenCalled();
    const written = prisma.product.update.mock.calls.at(-1)![0].data.attributes.tourBuilder;
    expect(written.currency).toBe("USD");
    expect(written.packageDiscountPct).toBe(5);
  });

  it("курсы без валюты: fxUsdAzn/fxEurAzn сохраняются, смена валюты использует сохранённые", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(productWithCurrency());
    prisma.tariff.findMany.mockResolvedValue([{ id: "TRF-1", price: 100 }]);
    const { service } = makeService(prisma);

    await service.setPackageRules("prod-1", { fxUsdAzn: 1.5, fxEurAzn: 1.6 }, PARTNER);
    const withFx = prisma.product.update.mock.calls.at(-1)![0].data.attributes.tourBuilder;
    expect(withFx.fx).toEqual({ usdAzn: 1.5, eurAzn: 1.6 });
    expect(prisma.tariff.update).not.toHaveBeenCalled(); // только курсы — без конвертации

    // Следующий вызов: валюта меняется, fx берутся из атрибутов.
    prisma.product.findUnique.mockResolvedValue({
      ...productWithCurrency(),
      attributes: { tourBuilder: { ...productWithCurrency().attributes.tourBuilder, fx: { usdAzn: 1.5, eurAzn: 1.6 } } },
    });
    const res = await service.setPackageRules("prod-1", { currency: "EUR" }, PARTNER);
    expect(res).toMatchObject({ converted: { from: "USD", to: "EUR", factor: 1.066667 } });
    expect(prisma.tariff.update.mock.calls[0][0].data.price.toNumber()).toBe(106.67); // 100 × 1.6/1.5
  });

  it("курс ≤ 0 → 422", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue(productWithCurrency());
    const { service } = makeService(prisma);

    await expect(service.setPackageRules("prod-1", { fxUsdAzn: 0 }, PARTNER)).rejects.toThrow(ValidationDomainError);
  });

  it("getState: package.currency/fx (дефолты USD и курсы), quote: currency", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({
      ...structuredClone(BUILDER_PRODUCT),
      serviceUnits: [
        { id: "UNI-1", code: "UNI-00000001", name: "Отель", attributes: { tourBuilderKind: "accommodation", payload: {} }, status: "ACTIVE", tariffs: [] },
      ],
    });
    const { service } = makeService(prisma);

    const state = await service.getState("prod-1", PARTNER);
    expect(state.package.currency).toBe("USD");
    expect(state.package.fx).toEqual({ usdAzn: 1.7, eurAzn: 1.85 });
  });
});

describe("TourBuilderService — справочники (предложение записи)", () => {
  it("точный normalized-дубль → 409", async () => {
    const prisma = makePrisma();
    prisma.roomType.findMany.mockResolvedValue([{ id: "r1", code: "STANDART", names: { ru: "Стандарт" }, sortOrder: 1, status: "ACTIVE" }]);
    const { service } = makeService(prisma);

    await expect(service.proposeDictionaryEntry(PARTNER, { type: "room-types", name: "STANDART ROOM" })).rejects.toThrow(ConflictError);
  });

  it("новая запись создаётся со статусом PENDING", async () => {
    const prisma = makePrisma();
    prisma.roomType.findMany.mockResolvedValue([]);
    prisma.roomType.create.mockResolvedValue({ id: "r2", code: "PANORAMA", status: "PENDING" });
    const { service } = makeService(prisma);

    const entry = await service.proposeDictionaryEntry(PARTNER, { type: "room-types", name: "Panorama Suite" });

    expect(entry.status).toBe("PENDING");
    expect(prisma.roomType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "PANORAMASUITE", status: "PENDING", createdBy: "u-partner" }) }),
    );
  });

  it("getDictionaries: ACTIVE записи из 4 справочников", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma);

    const dicts = await service.getDictionaries();

    expect(dicts).toHaveProperty("roomTypes");
    expect(dicts).toHaveProperty("viewTypes");
    expect(dicts).toHaveProperty("mealTypes");
    expect(dicts).toHaveProperty("placementTypes");
    expect(prisma.viewType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" } }));
  });

  it("similar: неизвестный тип справочника → 422", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma);

    await expect(service.similarDictionaryEntries("bogus", "x")).rejects.toThrow(ValidationDomainError);
  });
});

describe("TourBuilderService — доступ", () => {
  it("чужой продукт → 403 (own-scope policy)", async () => {
    const prisma = makePrisma();
    prisma.product.findUnique.mockResolvedValue({ ...BUILDER_PRODUCT, partnerId: "P2" });
    const { service } = makeService(prisma);

    await expect(service.setRequired("prod-1", "UNI-1", false, PARTNER)).rejects.toThrow(ForbiddenException);
  });
});
