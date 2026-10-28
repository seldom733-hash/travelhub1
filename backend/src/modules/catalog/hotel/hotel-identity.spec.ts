import { applyCanonicalName, cleanHotelName, groupHotelRefs, hotelGroupKey, nameSimilarity, normalizeName, parseStars, type HotelRef } from "./hotel-identity";

/**
 * Единый каталог фотографий отелей (Этап B/E).
 *
 * Ключевые свойства, которые здесь зафиксированы:
 *  - один физический отель = одна группа = одна фотография, независимо от того,
 *    в туре он, в услуге «Отели» или у разных поставщиков;
 *  - разные гостиницы с одинаковым названием в РАЗНЫХ городах не объединяются
 *    (иначе карточка показала бы чужое фото).
 */
function ref(over: Partial<HotelRef> & Pick<HotelRef, "supplierCode" | "externalKey" | "name">): HotelRef {
  const name = cleanHotelName(over.name);
  return {
    supplierCode: over.supplierCode,
    externalKey: over.externalKey,
    name,
    normalizedName: over.normalizedName ?? normalizeName(name),
    stars: over.stars ?? null,
    countryCode: over.countryCode ?? "",
    countryName: over.countryName ?? "",
    cityName: over.cityName ?? "",
    cityKey: over.cityKey ?? normalizeName(over.cityName ?? ""),
    resortName: over.resortName ?? "",
    hotelHref: over.hotelHref ?? "",
    source: over.source ?? "product",
  };
}

describe("cleanHotelName", () => {
  it("снимает хвост «(Город)» и звёзды в любом порядке", () => {
    expect(cleanHotelName("RADISSON BLU ISTANBUL PERA 5*\n   (Пера)")).toBe("RADISSON BLU ISTANBUL PERA");
    expect(cleanHotelName("MEMOIRE KUTAISI 3*")).toBe("MEMOIRE KUTAISI");
    expect(cleanHotelName("Hotel Name (City) 4*")).toBe("Hotel Name");
  });

  it("не съедает альтернативное имя в середине строки", () => {
    expect(cleanHotelName("Nungwi Beach Resort by TURACO (Ex. Doubletree by Hilton) 4*")).toBe(
      "Nungwi Beach Resort by TURACO",
    );
  });

  it("схлопывает пробелы и убирает «звёздочку» без цифры", () => {
    expect(cleanHotelName("  Al   Hayat Hotel* 4*  ")).toBe("Al Hayat Hotel");
  });
});

describe("parseStars", () => {
  it("берёт категорию из названия", () => {
    expect(parseStars("RADISSON BLU 5* (Пера)")).toBe(5);
    expect(parseStars("Al Hayat Hotel* 4*")).toBe(4);
    expect(parseStars("Без категории")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("приводит к нижнему регистру и убирает пунктуацию", () => {
    expect(normalizeName("Zenseana Resort & Spa")).toBe("zenseana resort spa");
    expect(normalizeName("A5 HOTEL.")).toBe("a5 hotel");
  });

  it("сохраняет кириллицу", () => {
    expect(normalizeName("Султанахмет")).toBe("султанахмет");
  });
});

describe("groupHotelRefs — одна фотография на физическую гостиницу", () => {
  it("два поставщика с одним отелем → одна запись (одно фото)", () => {
    const groups = groupHotelRefs([
      ref({ supplierCode: "KOMPAS", externalKey: "31189", name: "DARKHILL HOTEL (Лалели)", cityName: "Лалели", countryCode: "TR" }),
      ref({ supplierCode: "SUMMERTOUR", externalKey: "1205", name: "DARKHILL HOTEL 4*", cityName: "Лалели", countryCode: "TR" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].refs.map((r) => `${r.supplierCode}:${r.externalKey}`).sort()).toEqual([
      "KOMPAS:31189",
      "SUMMERTOUR:1205",
    ]);
  });

  it("тур и услуга «Отели» с одним supplier-native id → одна запись", () => {
    // Один и тот же hotelKey у поставщика (тур и stay-only отель) — это один
    // отель; caller дедуплицирует по (supplierCode, externalKey) до группировки.
    const groups = groupHotelRefs([
      ref({ supplierCode: "KOMPAS", externalKey: "25099", name: "RADISSON BLU ISTANBUL PERA (Пера)", cityName: "Пера", countryCode: "TR" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].refs).toHaveLength(1);
  });

  it("одинаковое название в РАЗНЫХ городах → разные записи (не делим фото)", () => {
    const groups = groupHotelRefs([
      ref({ supplierCode: "KOMPAS", externalKey: "1", name: "GRAND HOTEL 4*", cityName: "Анталья", countryCode: "TR" }),
      ref({ supplierCode: "KOMPAS", externalKey: "2", name: "GRAND HOTEL 4*", cityName: "Стамбул", countryCode: "TR" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("одинаковое название в разных странах → разные записи", () => {
    const groups = groupHotelRefs([
      ref({ supplierCode: "KOMPAS", externalKey: "1", name: "HOTEL SUN", cityName: "Батуми", countryCode: "GE" }),
      ref({ supplierCode: "KOMPAS", externalKey: "2", name: "HOTEL SUN", cityName: "Батуми", countryCode: "TR" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("переклассификация звёзд не разрывает один отель", () => {
    const groups = groupHotelRefs([
      ref({ supplierCode: "KOMPAS", externalKey: "17649", name: "Jaz Fanara Resort 4*", cityName: "Рас Ум Эль Сид", countryCode: "EG" }),
      ref({ supplierCode: "KOMPAS", externalKey: "9823", name: "Jaz Fanara Resort 5*", cityName: "Рас Ум Эль Сид", countryCode: "EG" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].refs).toHaveLength(2);
  });

  it("hotelGroupKey учитывает имя, страну и город", () => {
    const a = ref({ supplierCode: "X", externalKey: "1", name: "Hotel A", cityName: "Кута", countryCode: "ID" });
    const b = ref({ supplierCode: "Y", externalKey: "2", name: "Hotel A", cityName: "Кута", countryCode: "ID" });
    const c = ref({ supplierCode: "Z", externalKey: "3", name: "Hotel A", cityName: "Кута", countryCode: "TH" });
    expect(hotelGroupKey(a)).toBe(hotelGroupKey(b));
    expect(hotelGroupKey(a)).not.toBe(hotelGroupKey(c));
  });
});

describe("applyCanonicalName — единое имя отеля в карточке", () => {
  it("сохраняет хвост программы тура после « — »", () => {
    expect(applyCanonicalName("KOMPAS Hotel 4* (Baku, AZ) — Baku–Dubai", "KOMPAS Hotel")).toBe(
      "KOMPAS Hotel — Baku–Dubai",
    );
  });

  it("сохраняет гео-хвост карточки отеля", () => {
    expect(applyCanonicalName("KOMPAS Hotel 4* (Baku, AZ)", "KOMPAS Hotel")).toBe("KOMPAS Hotel (Baku, AZ)");
  });

  it("без хвоста возвращает каноническое имя целиком", () => {
    expect(applyCanonicalName("KOMPAS Hotel 4*", "KOMPAS Hotel")).toBe("KOMPAS Hotel");
  });

  it("пустое каноническое имя не меняет title", () => {
    expect(applyCanonicalName("KOMPAS Hotel 4*", "")).toBe("KOMPAS Hotel 4*");
    expect(applyCanonicalName("KOMPAS Hotel 4*", null)).toBe("KOMPAS Hotel 4*");
    expect(applyCanonicalName("KOMPAS Hotel 4*", "   ")).toBe("KOMPAS Hotel 4*");
  });
});

describe("nameSimilarity — сигнал для ручной проверки, не доказательство", () => {
  it("одинаковые названия → 1", () => {
    expect(nameSimilarity("Hilton Baku", "Hilton Baku")).toBe(1);
  });

  it("служебные слова не мешают: порядок токенов не важен", () => {
    expect(nameSimilarity("Hilton Baku Hotel", "Hilton Hotel Baku")).toBe(1);
  });

  it("разные отели в одном городе → низкая похожесть", () => {
    expect(nameSimilarity("Hilton Baku", "Marriott Baku")).toBeLessThan(0.5);
  });

  it("пустые/служебные названия → 0", () => {
    expect(nameSimilarity("", "Hilton")).toBe(0);
    expect(nameSimilarity("Hilton", "")).toBe(0);
    expect(nameSimilarity("Hotel", "Resort")).toBe(0);
  });
});
