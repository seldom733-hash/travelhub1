import {
  findSimilarCandidates,
  levenshtein,
  normalizeTypeName,
  translit,
} from "./dictionary-similarity";

describe("dictionary-similarity", () => {
  describe("translit / normalizeTypeName", () => {
    it("кириллица → латиница по-буквенно", () => {
      expect(translit("Стандарт")).toBe("STANDART");
    });

    it("Standard (en) и Стандарт (ru) — близкие ключи, ловятся fuzzy", () => {
      expect(normalizeTypeName("Standard")).toBe("STANDARD");
      expect(normalizeTypeName("Стандарт")).toBe("STANDART");
      expect(normalizeTypeName("STANDART")).toBe("STANDART");
      // англ. «d» vs транслит «t» — расстояние 1, кандидат найдётся
      expect(levenshtein(normalizeTypeName("Standard"), normalizeTypeName("Стандарт"))).toBe(1);
    });

    it("синонимы ROOM/APARTMENT/НОМЕР отбрасываются", () => {
      expect(normalizeTypeName("Standart Room")).toBe("STANDART");
      expect(normalizeTypeName("STANDART ROOM")).toBe("STANDART");
      expect(normalizeTypeName("Номер стандарт")).toBe("STANDART");
      expect(normalizeTypeName("Standard Apartment")).toBe("STANDARD");
    });

    it("прочие знаки/пробелы схлопываются", () => {
      expect(normalizeTypeName("  junior   suite ")).toBe("JUNIORSUITE");
      expect(normalizeTypeName("—")).toBe("");
    });

    it("Ё → Е", () => {
      expect(normalizeTypeName("Берёзовый")).toBe(normalizeTypeName("Березовый"));
    });
  });

  describe("levenshtein", () => {
    it("базовые случаи", () => {
      expect(levenshtein("", "")).toBe(0);
      expect(levenshtein("abc", "abc")).toBe(0);
      expect(levenshtein("abc", "")).toBe(3);
      expect(levenshtein("standart", "standard")).toBe(1);
      expect(levenshtein("kitten", "sitting")).toBe(3);
    });
  });

  describe("findSimilarCandidates", () => {
    const entries = [
      { id: "1", code: "STD", names: { ru: "Стандарт", en: "Standard" } },
      { id: "2", code: "DELUXE", names: { ru: "Делюкс", en: "Deluxe" } },
      { id: "3", code: "SUITE", names: { ru: "Люкс", en: "Suite" } },
    ];

    it("точное совпадение → score 1", () => {
      const res = findSimilarCandidates("Standart", entries);
      expect(res[0]?.id).toBe("1");
      expect(res[0]?.score).toBe(1);
    });

    it("опечатка ловится (стандарт vs standart)", () => {
      const res = findSimilarCandidates("Стандартт", entries);
      expect(res[0]?.id).toBe("1");
      expect(res[0]?.score).toBeGreaterThan(0.72);
    });

    it("несвязанный запрос → пусто", () => {
      expect(findSimilarCandidates("Aquapark Villa", entries)).toHaveLength(0);
    });

    it("пустой/бессмысленный запрос → пусто", () => {
      expect(findSimilarCandidates("—", entries)).toHaveLength(0);
      expect(findSimilarCandidates("", entries)).toHaveLength(0);
    });

    it("сортировка по score, лимит", () => {
      const many = [
        { id: "a", code: "A", names: { en: "Standard" } },
        { id: "b", code: "B", names: { en: "Standart Room" } },
        { id: "c", code: "C", names: { en: "Stadart" } },
      ];
      const res = findSimilarCandidates("standard", many, { limit: 2 });
      expect(res).toHaveLength(2);
      expect(res[0].score).toBeGreaterThanOrEqual(res[1].score);
    });
  });
});
