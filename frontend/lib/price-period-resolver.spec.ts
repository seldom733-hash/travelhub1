import { describe, expect, it } from "vitest";
import {
  type ApiPeriod,
  type PriceLayer,
  addDaysIso,
  cellPrice,
  compileLayers,
  dayCount,
  decompilePeriods,
  findSamePriorityOverlap,
  pickVariantForView,
  removeSpecialDay,
  resolvePrice,
  upsertSpecialDay,
} from "./price-period-resolver";

const p = (over: Partial<ApiPeriod> & { id: string; startDate: string; endDate: string }): ApiPeriod => ({
  code: over.id,
  kind: "PERIOD",
  dayOfWeek: [],
  price: 100,
  sellable: true,
  ...over,
});

describe("resolvePrice (mirror DD-026 precedence)", () => {
  const wide = p({ id: "w", startDate: "2026-06-01", endDate: "2026-08-31", price: 100 });
  const narrow = p({ id: "n", startDate: "2026-07-01", endDate: "2026-07-15", price: 150 });
  const override = p({ id: "o", kind: "DATE_OVERRIDE", startDate: "2026-07-05", endDate: "2026-07-05", price: 999 });
  const weekend = p({ id: "we", startDate: "2026-07-01", endDate: "2026-07-15", dayOfWeek: [6, 0], price: 180 });

  it("DATE_OVERRIDE бьёт уже́й период, уже́й — широкий", () => {
    expect(resolvePrice([wide, narrow, override], "2026-07-05")?.price).toBe(999);
    expect(resolvePrice([wide, narrow, override], "2026-07-10")?.price).toBe(150);
    expect(resolvePrice([wide, narrow, override], "2026-07-20")?.price).toBe(100);
  });

  it("период с dayOfWeek выигрывает у голого того же диапазона", () => {
    const same = p({ id: "same", startDate: "2026-07-01", endDate: "2026-07-15", price: 140 });
    // 2026-07-04 — суббота (6)
    expect(resolvePrice([same, weekend], "2026-07-04")?.price).toBe(180);
    expect(resolvePrice([same, weekend], "2026-07-06")?.price).toBe(140);
  });

  it("день с dow-периодом, но вне прочих applicable → base фолбэк через null", () => {
    expect(resolvePrice([weekend], "2026-07-07")).toBeNull();
  });

  it("только узкий период покрывает дату вне широкого", () => {
    expect(resolvePrice([narrow], "2026-05-31")).toBeNull();
  });

  it("tie-break по id (детерминизм)", () => {
    const a = p({ id: "a", startDate: "2026-07-01", endDate: "2026-07-15", price: 10 });
    const b = p({ id: "b", startDate: "2026-07-01", endDate: "2026-07-15", price: 20 });
    expect(resolvePrice([b, a], "2026-07-02")?.price).toBe(10);
    expect(resolvePrice([a, b], "2026-07-02")?.price).toBe(10);
  });
});

describe("cellPrice", () => {
  it("резолвер, иначе базовая цена", () => {
    const periods = [p({ id: "x", startDate: "2026-01-01", endDate: "2026-01-31", price: 120 })];
    expect(cellPrice(periods, "2026-01-10", 90)).toEqual({ price: 120, sourceId: "x" });
    expect(cellPrice(periods, "2026-02-10", 90)).toEqual({ price: 90, sourceId: null });
  });
});

describe("compileLayers / decompilePeriods", () => {
  it("SPECIAL → DATE_OVERRIDE без dayOfWeek, WEEKEND → PERIOD с dow", () => {
    const compiled = compileLayers([
      { id: "l1", block: "BASE", startDate: "2026-06-01", endDate: "2026-08-31", price: 100, dayOfWeek: [] },
      { id: "l2", block: "WEEKEND", startDate: "2026-06-01", endDate: "2026-08-31", price: 130, dayOfWeek: [6] },
      { id: "l3", block: "SPECIAL", startDate: "2026-06-12", endDate: "2026-06-12", price: 200, dayOfWeek: [] },
    ]);
    expect(compiled[0].kind).toBe("PERIOD");
    expect(compiled[1]).toMatchObject({ kind: "PERIOD", dayOfWeek: [6] });
    expect(compiled[2]).toMatchObject({ kind: "DATE_OVERRIDE", dayOfWeek: [] });
  });

  it("round-trip: decompile → compile сохраняет kind/dow/даты/цену", () => {
    const periods: ApiPeriod[] = [
      p({ id: "base", startDate: "2026-06-01", endDate: "2026-09-30", price: 100 }),
      p({ id: "hol", startDate: "2026-07-01", endDate: "2026-07-20", price: 150 }),
      p({ id: "wk", startDate: "2026-06-01", endDate: "2026-09-30", dayOfWeek: [5, 6], price: 120 }),
      p({ id: "sp", kind: "DATE_OVERRIDE", startDate: "2026-06-12", endDate: "2026-06-12", price: 300 }),
    ];
    const layers = decompilePeriods(periods);
    expect(layers.find((l) => l.id === "base")?.block).toBe("BASE");
    expect(layers.find((l) => l.id === "hol")?.block).toBe("HOLIDAY");
    expect(layers.find((l) => l.id === "wk")?.block).toBe("WEEKEND");
    expect(layers.find((l) => l.id === "sp")?.block).toBe("SPECIAL");
    const round = compileLayers(layers);
    expect(round).toEqual(
      periods.map((x) => ({ startDate: x.startDate, endDate: x.endDate, price: x.price, kind: x.kind, dayOfWeek: x.dayOfWeek })),
    );
  });

  it("самый широкий голый период → BASE даже если второй уже́й по дате старта", () => {
    const periods = [
      p({ id: "later", startDate: "2026-07-01", endDate: "2026-08-31", price: 110 }),
      p({ id: "full", startDate: "2026-01-01", endDate: "2026-12-31", price: 100 }),
    ];
    const layers = decompilePeriods(periods);
    expect(layers.find((l) => l.id === "full")?.block).toBe("BASE");
    expect(layers.find((l) => l.id === "later")?.block).toBe("HOLIDAY");
  });
});

describe("findSamePriorityOverlap", () => {
  it("пересечение с идентичным ключом — запрещено", () => {
    expect(
      findSamePriorityOverlap([
        { kind: "PERIOD", startDate: "2026-07-01", endDate: "2026-07-15", dayOfWeek: [] },
        { kind: "PERIOD", startDate: "2026-07-10", endDate: "2026-07-24", dayOfWeek: [] },
      ]),
    ).toBe(true);
  });

  it("разная ширина или dow-флаг — можно", () => {
    expect(
      findSamePriorityOverlap([
        { kind: "PERIOD", startDate: "2026-07-01", endDate: "2026-07-15", dayOfWeek: [] },
        { kind: "PERIOD", startDate: "2026-07-10", endDate: "2026-07-11", dayOfWeek: [] },
      ]),
    ).toBe(false);
    expect(
      findSamePriorityOverlap([
        { kind: "PERIOD", startDate: "2026-07-01", endDate: "2026-07-15", dayOfWeek: [6] },
        { kind: "PERIOD", startDate: "2026-07-10", endDate: "2026-07-24", dayOfWeek: [] },
      ]),
    ).toBe(false);
  });
});

describe("upsert/removeSpecialDay", () => {
  it("заменяет попавшую SPECIAL-дату, не трогая слои другого блока", () => {
    let layers: PriceLayer[] = [
      { id: "b", block: "BASE", startDate: "2026-01-01", endDate: "2026-12-31", price: 100, dayOfWeek: [] },
      { id: "special:2026-07-05", block: "SPECIAL", startDate: "2026-07-05", endDate: "2026-07-05", price: 200, dayOfWeek: [] },
    ];
    layers = upsertSpecialDay(layers, "2026-07-05", 250);
    expect(layers).toHaveLength(2);
    expect(layers[1].price).toBe(250);
    layers = upsertSpecialDay(layers, "2026-07-06", 300);
    expect(layers).toHaveLength(3);
    layers = removeSpecialDay(layers, "2026-07-05");
    expect(layers).toHaveLength(2);
    expect(layers.find((l) => l.block === "BASE")).toBeTruthy();
  });
});

describe("pickVariantForView (decision #4)", () => {
  const rows = [
    { viewCode: "SEA", id: "1" },
    { viewCode: null, id: "2" },
    { viewCode: "CITY", id: "3" },
  ];

  it("точный вид → строка без фолбэка", () => {
    expect(pickVariantForView(rows, "SEA")).toEqual({ row: rows[0], fallback: "none" });
  });

  it("нет точного → строка «-» с пометкой blank", () => {
    expect(pickVariantForView(rows, "MOUNTAIN")).toEqual({ row: rows[1], fallback: "blank" });
  });

  it("нет ни точного, ни «-» → null (warning)", () => {
    expect(pickVariantForView([{ viewCode: "SEA" }], "CITY")).toBeNull();
    expect(pickVariantForView([{ viewCode: "SEA" }], null)).toBeNull();
  });

  it("без запрошенного вида → просто первая строка без вида", () => {
    expect(pickVariantForView(rows, null)).toEqual({ row: rows[1], fallback: "none" });
  });
});

describe("дата-утилиты", () => {
  it("dayCount и addDaysIso", () => {
    expect(dayCount("2026-07-01", "2026-07-15")).toBe(15);
    expect(addDaysIso("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
});
