/**
 * PHASE 2 STEP 2.8A — unit tests: canonical service time model.
 *
 * Покрывает (§37 implementation prompt): parsing/валидация времени и IANA,
 * DST-ambiguity (fall-back) и nonexistence (spring-forward), local→UTC конверсия,
 * date-only поведение (никакого UTC-midnight fabrication), cross-midnight end,
 * деривация типа occurrence, serialization.
 *
 * Требование §9: детерминированные DST-тесты для минимум одной DST-зоны.
 * Используются Europe/Paris (DST) + Asia/Baku (без DST).
 */
import {
  deriveServiceEndsAt,
  deriveServiceStartsAt,
  deriveServiceTimeType,
  isIanaTimeZone,
  isLocalTime,
  localToUtc,
  offsetMinutesAt,
} from "./service-time";

const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe("Step 2.8A service time model — parsing & validation (§27)", () => {
  it("HH:mm: принимает 00:00..23:59, отклоняет 24:00/9:30/12:60/abc", () => {
    expect(isLocalTime("00:00")).toBe(true);
    expect(isLocalTime("09:30")).toBe(true);
    expect(isLocalTime("23:59")).toBe(true);
    expect(isLocalTime("24:00")).toBe(false);
    expect(isLocalTime("9:30")).toBe(false);
    expect(isLocalTime("12:60")).toBe(false);
    expect(isLocalTime("12:3")).toBe(false);
    expect(isLocalTime("abc")).toBe(false);
    expect(isLocalTime("")).toBe(false);
  });

  it("IANA: принимает канонические ID (Asia/Baku, Europe/Paris), отклоняет offset/выдумки", () => {
    expect(isIanaTimeZone("Asia/Baku")).toBe(true);
    expect(isIanaTimeZone("Europe/Paris")).toBe(true);
    expect(isIanaTimeZone("America/New_York")).toBe(true);
    // offset НЕ является authority (§8): raw offset-строки отклоняются
    expect(isIanaTimeZone("UTC+4")).toBe(false);
    expect(isIanaTimeZone("+04:00")).toBe(false);
    // регистро-чувствительно (IANA канон), не изобретаем zone
    expect(isIanaTimeZone("ASIA/BAKU")).toBe(false);
    expect(isIanaTimeZone("Baku/Asia")).toBe(false);
    expect(isIanaTimeZone("")).toBe(false);
    expect(isIanaTimeZone("Browser/Locale")).toBe(false);
  });

  it("offsetMinutesAt: Intl-derived offsets (Asia/Baku +04:00, Paris CEST +02:00)", () => {
    expect(offsetMinutesAt("Asia/Baku", Date.UTC(2026, 8, 1, 10, 30))).toBe(240);
    expect(offsetMinutesAt("Europe/Paris", Date.UTC(2026, 8, 1, 10, 30))).toBe(120); // CEST
    expect(offsetMinutesAt("Europe/Paris", Date.UTC(2026, 0, 15, 10, 30))).toBe(60); // CET
  });
});

describe("Step 2.8A service time model — local → UTC (§9/§13)", () => {
  it("non-DST зона: 2026-09-01 14:30 Asia/Baku → 10:30Z", () => {
    expect(localToUtc("2026-09-01", "14:30", "Asia/Baku").toISOString()).toBe("2026-09-01T10:30:00.000Z");
  });

  it("DST зона (лето): 2026-09-01 14:30 Europe/Paris (CEST +2) → 12:30Z", () => {
    expect(localToUtc("2026-09-01", "14:30", "Europe/Paris").toISOString()).toBe("2026-09-01T12:30:00.000Z");
  });

  it("DST зона (зима): 2026-01-15 14:30 Europe/Paris (CET +1) → 13:30Z", () => {
    expect(localToUtc("2026-01-15", "14:30", "Europe/Paris").toISOString()).toBe("2026-01-15T13:30:00.000Z");
  });

  it("DST ambiguous (fall-back 2026-10-25 02:30 Paris встречается дважды) → РАННИЙ instant 00:30Z", () => {
    const inst = localToUtc("2026-10-25", "02:30", "Europe/Paris");
    // 02:30 CEST = 00:30Z (pre-transition, earlier) — детерминированный выбор
    expect(inst.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(offsetMinutesAt("Europe/Paris", inst.getTime())).toBe(120);
  });

  it("DST nonexistent (spring-forward 2026-03-29 02:30 Paris пропущено) → instant сразу после gap: 03:30 CEST = 01:30Z", () => {
    const inst = localToUtc("2026-03-29", "02:30", "Europe/Paris");
    // 02:00→03:00: wall 02:30 не существует; детерминированный результат 03:30 CEST
    expect(inst.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(offsetMinutesAt("Europe/Paris", inst.getTime())).toBe(120);
  });

  it("невалидные входы → ValidationDomainError (не raw-ошибки)", () => {
    expect(() => localToUtc("2026-02-30", "14:30", "Asia/Baku")).toThrow(/calendar date/);
    expect(() => localToUtc("2026-09-01", "25:00", "Asia/Baku")).toThrow(/HH:mm/);
    expect(() => localToUtc("2026-09-01", "14:30", "Not/AZone")).toThrow(/IANA/);
  });
});

describe("Step 2.8A service time model — derived Booking facts (§7/§12/§13)", () => {
  it("date-only: serviceStartsAt/EndsAt = null (UTC-midnight НЕ фабрикуется)", () => {
    expect(deriveServiceStartsAt(d("2026-09-01"), null, null)).toBeNull();
    expect(deriveServiceEndsAt(d("2026-09-01"), null, null, null)).toBeNull();
    expect(deriveServiceStartsAt(d("2026-09-01"), null, "Asia/Baku")).toBeNull(); // zone без time не стартует
  });

  it("time без zone → ValidationDomainError (defensive: дефект ленты → FAILED)", () => {
    expect(() => deriveServiceStartsAt(d("2026-09-01"), "14:30", null)).toThrow(/requires serviceTimeZone/);
  });

  it("TIME_SLOT: serviceStartsAt = derived instant; serviceEndsAt = end time того же дня", () => {
    const startsAt = deriveServiceStartsAt(d("2026-09-01"), "14:30", "Asia/Baku");
    expect(startsAt!.toISOString()).toBe("2026-09-01T10:30:00.000Z");
    const endsAt = deriveServiceEndsAt(d("2026-09-01"), "14:30", "16:30", "Asia/Baku");
    expect(endsAt!.toISOString()).toBe("2026-09-01T12:30:00.000Z");
  });

  it("cross-midnight end (23:30 → 01:30 следующего local дня): 2026-09-01 23:30→01:30 = 2026-09-02 01:30 Asia/Baku → 2026-09-01T21:30Z", () => {
    const endsAt = deriveServiceEndsAt(d("2026-09-01"), "23:30", "01:30", "Asia/Baku");
    expect(endsAt!.toISOString()).toBe("2026-09-01T21:30:00.000Z");
  });

  it("end без start-time / end без end-time → null (не фиктивные факты)", () => {
    expect(deriveServiceEndsAt(d("2026-09-01"), null, "16:30", "Asia/Baku")).toBeNull();
    expect(deriveServiceEndsAt(d("2026-09-01"), "14:30", null, "Asia/Baku")).toBeNull();
  });

  it("deriveServiceTimeType: OPEN_DATE (дата неизвестна) > TIME_SLOT > DATE_ONLY; DATE_RANGE не продуцируется", () => {
    expect(deriveServiceTimeType(null, null)).toBe("OPEN_DATE");
    expect(deriveServiceTimeType(null, "14:30")).toBe("OPEN_DATE");
    expect(deriveServiceTimeType(d("2026-09-01"), "14:30")).toBe("TIME_SLOT");
    expect(deriveServiceTimeType(d("2026-09-01"), null)).toBe("DATE_ONLY");
    expect(deriveServiceTimeType(d("2026-09-01"), null)).not.toBe("DATE_RANGE");
  });

  it("сериализация детерминирована: date-only YYYY-MM-DD (UTC-midnight), instant ISO-8601 Z", () => {
    const startsAt = deriveServiceStartsAt(d("2026-09-01"), "14:30", "Europe/Paris")!;
    expect(startsAt.toISOString()).toBe("2026-09-01T12:30:00.000Z");
    expect(d("2026-09-01").toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});
