import { describe, expect, it } from "vitest";
import { type MatrixAxes, combineAxes, collectVariantRefs, diffWithExisting, facetKey, mergeRows } from "./matrix-combine";

const axes: MatrixAxes = {
  roomTypes: [
    { id: "rt1", code: "DLX", name: "Делюкс" },
    { id: "rt2", code: "STD", name: "Стандарт" },
  ],
  views: [
    { code: "SEA", name: "Море" },
    { code: null, name: "—" },
  ],
  meals: [
    { id: "m1", code: "BB", name: "Завтрак" },
    { id: "m2", code: "HB", name: "Полупансион" },
  ],
  placements: [
    { id: "p1", code: "DBL", name: "2-местное" },
    { id: "p2", code: "SNGL", name: "1-местное" },
  ],
};

describe("combineAxes", () => {
  it("декарт: 2×2×2×2 = 16 строк, порядок осей сохранён", () => {
    const rows = combineAxes(axes);
    expect(rows).toHaveLength(16);
    expect(rows[0]).toEqual({
      roomTypeId: "rt1",
      roomTypeName: "Делюкс",
      viewCode: "SEA",
      mealCode: "BB",
      placementCode: "DBL",
    });
    expect(rows.filter((r) => r.roomTypeId === "rt1")).toHaveLength(8);
  });

  it("строка «-» (viewCode null) присутствует", () => {
    const rows = combineAxes(axes);
    expect(rows.some((r) => r.viewCode === null)).toBe(true);
    expect(rows.filter((r) => r.viewCode === null)).toHaveLength(8);
  });

  it("пустая ось → []", () => {
    expect(combineAxes({ ...axes, roomTypes: [] })).toEqual([]);
  });

  it("оси Ext.Bed/Ext.Sofa: undefined = участвует как [false], явные значения ×2", () => {
    expect(combineAxes(axes)).toHaveLength(16);
    const withExt = combineAxes({ ...axes, extraBed: [false, true], extraSofa: [false, true] });
    expect(withExt).toHaveLength(64);
    expect(withExt.filter((r) => r.extraBed && r.extraSofa)).toHaveLength(16);
    // Строки без доп.опций не получают ключей extraBed/extraSofa (совместимость).
    expect("extraBed" in withExt[0]).toBe(false);
    expect(withExt.filter((r) => r.extraBed === true && r.extraSofa !== true)).toHaveLength(16);
    expect(combineAxes({ ...axes, extraBed: [] })).toEqual([]);
  });
});

describe("facetKey / mergeRows", () => {
  it("null-вид и пустой ключ различимы корректно", () => {
    expect(facetKey({ roomTypeId: "r", viewCode: null, mealCode: "BB", placementCode: "DBL" })).toBe("r||BB|DBL");
    expect(facetKey({ roomTypeId: "r", viewCode: "SEA", mealCode: "BB", placementCode: "DBL" })).toBe("r|SEA|BB|DBL");
  });

  it("доп.опции добавляют суффикс: Ext.Bed=10, обе=11, без доп.опций — без суффикса", () => {
    expect(facetKey({ roomTypeId: "r", viewCode: null, mealCode: "BB", placementCode: "DBL", extraBed: true })).toBe("r||BB|DBL|10");
    expect(facetKey({ roomTypeId: "r", viewCode: null, mealCode: "BB", placementCode: "DBL", extraBed: true, extraSofa: true })).toBe(
      "r||BB|DBL|11",
    );
    expect(facetKey({ roomTypeId: "r", viewCode: null, mealCode: "BB", placementCode: "DBL", extraBed: false })).toBe("r||BB|DBL");
  });

  it("mergeRows дедупит по ключу, ручные добавляются после сгенерированных", () => {
    const generated = combineAxes(axes);
    const manual = [
      { roomTypeId: "rt3", viewCode: null, mealCode: "BB", placementCode: "DBL" },
      generated[0], // дубль
    ];
    const merged = mergeRows(generated, manual);
    expect(merged).toHaveLength(17);
    expect(merged[16].roomTypeId).toBe("rt3");
  });
});

describe("diffWithExisting", () => {
  it("размечает строки: ref есть → создано, иначе null", () => {
    const rows = combineAxes(axes);
    const refs = new Map([[facetKey(rows[0]), { componentId: "c1", variantId: "v1" }]]);
    const diffed = diffWithExisting(rows, refs);
    expect(diffed[0].ref).toEqual({ componentId: "c1", variantId: "v1" });
    expect(diffed[1].ref).toBeNull();
    expect(diffed).toHaveLength(16);
  });
});

describe("collectVariantRefs", () => {
  it("собирает ключи из payload.roomTypeId + inclusions, юнит без roomTypeId пропускается", () => {
    const refs = collectVariantRefs([
      {
        componentId: "c1",
        payload: { roomTypeId: "rt1" },
        tariffs: [
          { id: "v1", inclusions: { viewCode: "SEA", mealCode: "BB", placementCode: "DBL" } },
          { id: "v2", inclusions: null },
        ],
      },
      { componentId: "c2", payload: {}, tariffs: [{ id: "v3", inclusions: null }] },
    ]);
    expect(refs.get("rt1|SEA|BB|DBL")).toEqual({ componentId: "c1", variantId: "v1" });
    expect(refs.get("rt1|||")).toEqual({ componentId: "c1", variantId: "v2" });
    expect(refs.size).toBe(2);
  });

  it("inclusions.extraBed/extraSofa → ключи с суффиксом |10/|01/|11", () => {
    const refs = collectVariantRefs([
      {
        componentId: "c1",
        payload: { roomTypeId: "rt1" },
        tariffs: [
          { id: "v1", inclusions: { mealCode: "BB", placementCode: "DBL", extraBed: true } },
          { id: "v2", inclusions: { mealCode: "BB", placementCode: "DBL", extraSofa: true } },
          { id: "v3", inclusions: { mealCode: "BB", placementCode: "DBL", extraBed: true, extraSofa: true } },
          { id: "v4", inclusions: { mealCode: "BB", placementCode: "DBL", extraBed: false } },
        ],
      },
    ]);
    expect(refs.get("rt1||BB|DBL|10")).toEqual({ componentId: "c1", variantId: "v1" });
    expect(refs.get("rt1||BB|DBL|01")).toEqual({ componentId: "c1", variantId: "v2" });
    expect(refs.get("rt1||BB|DBL|11")).toEqual({ componentId: "c1", variantId: "v3" });
    expect(refs.get("rt1||BB|DBL")).toEqual({ componentId: "c1", variantId: "v4" });
  });
});
