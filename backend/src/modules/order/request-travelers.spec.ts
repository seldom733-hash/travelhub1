import { ValidationDomainError } from "../../shared/errors";
import {
  assertRequestTravelersMatchCount,
  assertRequestTravelerPosition,
  computeRequestTravelersReadiness,
  normalizeRequestTravelerInput,
} from "./request-travelers";

describe("normalizeRequestTravelerInput (§6 Request validation)", () => {
  it("хэппи-путь: trim + нормализация даты YYYY-MM-DD", () => {
    expect(
      normalizeRequestTravelerInput({
        firstName: "  Ilya  ",
        lastName: "Tester",
        birthDate: "1990-02-02",
      }),
    ).toEqual({ firstName: "Ilya", lastName: "Tester", birthDate: "1990-02-02" });
  });

  it("§2.2: на выходе ТОЛЬКО FIO + birthDate (никаких passport-полей)", () => {
    const out = normalizeRequestTravelerInput({
      firstName: "A",
      lastName: "B",
      birthDate: "1990-01-01",
      passportSeries: "AA",
      passportNumber: "123456",
      passportExpiry: "2030-01-01",
      citizenship: "AZ",
    } as Record<string, unknown>);
    expect(Object.keys(out).sort()).toEqual(["birthDate", "firstName", "lastName"]);
  });

  it("отсутствующее/пустое/не-строковое имя → 422", () => {
    const base = { firstName: "A", lastName: "B", birthDate: "1990-01-01" };
    for (const patch of [
      { firstName: undefined },
      { firstName: "" },
      { firstName: "   " },
      { firstName: 42 },
      { lastName: null },
      { lastName: { en: "X" } },
    ]) {
      expect(() => normalizeRequestTravelerInput({ ...base, ...patch })).toThrow(ValidationDomainError);
    }
  });

  it("имя длиннее 200 символов → 422 с max length", () => {
    expect(() =>
      normalizeRequestTravelerInput({
        firstName: "a".repeat(201),
        lastName: "B",
        birthDate: "1990-01-01",
      }),
    ).toThrow(/max length is 200/);
  });

  it("birthDate: не строка / не YYYY-MM-DD → 422", () => {
    const base = { firstName: "A", lastName: "B" };
    for (const birthDate of [undefined, null, 19900101, "02.02.1990", "1990-2-2", "1990-02-02T00:00:00.000Z", ""]) {
      expect(() => normalizeRequestTravelerInput({ ...base, birthDate })).toThrow(ValidationDomainError);
    }
  });

  it("несуществующая календарная дата → 422 (не «тихая» нормализация)", () => {
    expect(() =>
      normalizeRequestTravelerInput({ firstName: "A", lastName: "B", birthDate: "2026-02-30" }),
    ).toThrow(/not a real calendar date/);
    expect(() =>
      normalizeRequestTravelerInput({ firstName: "A", lastName: "B", birthDate: "2026-04-31" }),
    ).toThrow(/not a real calendar date/);
  });

  it("дата рождения в будущем → 422", () => {
    expect(() =>
      normalizeRequestTravelerInput({ firstName: "A", lastName: "B", birthDate: "2999-01-01" }),
    ).toThrow(/cannot be in the future/);
  });
});

describe("assertRequestTravelerPosition (§4)", () => {
  it("не задано (undefined/null/\"\") → null (позицию назначает сервер)", () => {
    expect(assertRequestTravelerPosition(undefined, 3)).toBeNull();
    expect(assertRequestTravelerPosition(null, 3)).toBeNull();
    expect(assertRequestTravelerPosition("", 3)).toBeNull();
    expect(assertRequestTravelerPosition(1, null)).toBe(1);
  });

  it("строка-число принимается, дробные/отрицательные → 422", () => {
    expect(assertRequestTravelerPosition("2", 3)).toBe(2);
    expect(() => assertRequestTravelerPosition(0, 3)).toThrow(/positive integer/);
    expect(() => assertRequestTravelerPosition(-1, 3)).toThrow(/positive integer/);
    expect(() => assertRequestTravelerPosition(1.5, 3)).toThrow(/positive integer/);
    expect(() => assertRequestTravelerPosition("abc", 3)).toThrow(/positive integer/);
  });

  it("позиция выше замороженного travelerCount → 422", () => {
    expect(assertRequestTravelerPosition(3, 3)).toBe(3);
    expect(() => assertRequestTravelerPosition(4, 3)).toThrow(/exceeds travelerCount 3/);
  });
});

describe("computeRequestTravelersReadiness (§6)", () => {
  const full = [
    { firstName: "A", lastName: "B", birthDate: new Date("1990-01-01") },
    { firstName: "C", lastName: "D", birthDate: new Date("1992-01-01") },
  ];

  it("полный состав, размер совпадает → true", () => {
    expect(computeRequestTravelersReadiness(full, 2)).toBe(true);
  });

  it("нет travelerCount / не целое / < 1 → false", () => {
    expect(computeRequestTravelersReadiness(full, null)).toBe(false);
    expect(computeRequestTravelersReadiness(full, undefined)).toBe(false);
    expect(computeRequestTravelersReadiness(full, 0)).toBe(false);
    expect(computeRequestTravelersReadiness(full, 1.5)).toBe(false);
  });

  it("размер не совпадает → false", () => {
    expect(computeRequestTravelersReadiness(full, 3)).toBe(false);
    expect(computeRequestTravelersReadiness([], 1)).toBe(false);
  });

  it("пустой/whitespace FIO или отсутствующая дата → false", () => {
    expect(computeRequestTravelersReadiness([{ firstName: " ", lastName: "B", birthDate: "1990-01-01" }], 1)).toBe(false);
    expect(computeRequestTravelersReadiness([{ firstName: "A", lastName: "", birthDate: "1990-01-01" }], 1)).toBe(false);
    expect(computeRequestTravelersReadiness([{ firstName: "A", lastName: "B", birthDate: null }], 1)).toBe(false);
    expect(computeRequestTravelersReadiness([{ firstName: "A", lastName: "B" }], 1)).toBe(false);
  });
});

describe("assertRequestTravelersMatchCount (§10 conversion invariant)", () => {
  const travelers = [
    { firstName: "A", lastName: "B", birthDate: "1990-01-01" },
    { firstName: "C", lastName: "D", birthDate: "1992-01-01" },
  ];

  it("совпадает → возвращает ожидаемый размер", () => {
    expect(assertRequestTravelersMatchCount(travelers, 2)).toBe(2);
  });

  it("travelerCount не задан → безопасный отказ (conversion refused)", () => {
    expect(() => assertRequestTravelersMatchCount(travelers, null)).toThrow(/travelerCount is not set/);
    expect(() => assertRequestTravelersMatchCount(travelers, undefined)).toThrow(/travelerCount is not set/);
    expect(() => assertRequestTravelersMatchCount(travelers, 0)).toThrow(/travelerCount is not set/);
  });

  it("несовпадение состава → 422 с traveler count mismatch", () => {
    expect(() => assertRequestTravelersMatchCount(travelers, 3)).toThrow(/traveler count mismatch/);
    expect(() => assertRequestTravelersMatchCount(travelers.slice(0, 1), 2)).toThrow(/conversion refused/);
  });
});
