import {
  DEFAULT_PASSPORT_EXPIRY_MARGIN_DAYS,
  resolveTripDates,
  validatePassportExpiry,
  validateTravelersPassportExpiry,
} from "./passport-expiry";

describe("validatePassportExpiry (§14)", () => {
  const tripEnd = "2027-06-30";

  it("OK: срок паспорта позже trip end + margin", () => {
    const v = validatePassportExpiry({ passportExpiry: "2030-01-01", tripEndDate: tripEnd, requireExpiry: true });
    expect(v.status).toBe("OK");
    expect(v.code).toBe("OK");
    expect(v.passportExpiry).toBe("2030-01-01");
    expect(v.tripEndDate).toBe("2027-06-30");
    expect(v.marginDays).toBe(DEFAULT_PASSPORT_EXPIRY_MARGIN_DAYS);
  });

  it("BLOCK: паспорт истекает раньше trip end (§4 правило passportExpiry < tripEndDate)", () => {
    const v = validatePassportExpiry({ passportExpiry: "2027-06-29", tripEndDate: tripEnd, requireExpiry: true });
    expect(v.status).toBe("BLOCK");
    expect(v.code).toBe("EXPIRED");
    expect(v.message).toContain("before trip end");
  });

  it("тот же календарный день не считается истечением (нет ложного BLOCK из-за времени суток)", () => {
    const sameDay = validatePassportExpiry({
      passportExpiry: new Date("2027-06-30T23:59:00.000Z"),
      tripEndDate: new Date("2027-06-30T00:00:00.000Z"),
      requireExpiry: true,
    });
    // паспорт действует весь последний день поездки → НЕ BLOCK; но срок истекает
    // сразу после trip end → WARNING (в пределах margin).
    expect(sameDay.status).toBe("WARNING");
    expect(sameDay.code).toBe("EXPIRING_WITHIN_MARGIN");
    const before = validatePassportExpiry({
      passportExpiry: "2027-06-29",
      tripEndDate: new Date("2027-06-30T00:00:00.000Z"),
      requireExpiry: true,
    });
    expect(before.status).toBe("BLOCK");
    expect(before.code).toBe("EXPIRED");
  });

  it("WARNING: истекает в пределах margin после trip end", () => {
    const v = validatePassportExpiry({ passportExpiry: "2027-08-01", tripEndDate: tripEnd, requireExpiry: true });
    expect(v.status).toBe("WARNING");
    expect(v.code).toBe("EXPIRING_WITHIN_MARGIN");
    expect(v.message).toContain(`${DEFAULT_PASSPORT_EXPIRY_MARGIN_DAYS} days`);
  });

  it("marginDays настраивается (не юридический универсал)", () => {
    const strict = validatePassportExpiry({
      passportExpiry: "2027-08-01",
      tripEndDate: tripEnd,
      marginDays: 365,
      requireExpiry: true,
    });
    expect(strict.status).toBe("WARNING");
    const loose = validatePassportExpiry({
      passportExpiry: "2027-08-01",
      tripEndDate: tripEnd,
      marginDays: 7,
      requireExpiry: true,
    });
    expect(loose.status).toBe("OK");
    expect(loose.marginDays).toBe(7);
  });

  it("BLOCK: срок отсутствует, поле REQUIRED", () => {
    const v = validatePassportExpiry({ passportExpiry: null, tripEndDate: tripEnd, requireExpiry: true });
    expect(v.status).toBe("BLOCK");
    expect(v.code).toBe("MISSING_PASSPORT_EXPIRY");
    expect(v.passportExpiry).toBeNull();
  });

  it("OK: срок отсутствует, поле НЕ REQUIRED (§2.3 — проверять нечего)", () => {
    const v = validatePassportExpiry({ passportExpiry: null, tripEndDate: tripEnd, requireExpiry: false });
    expect(v.status).toBe("OK");
    expect(v.code).toBe("OK");
  });

  it("WARNING: даты поездки неизвестны (legacy Order без serviceDate не блокируется)", () => {
    const v = validatePassportExpiry({ passportExpiry: "2030-01-01", requireExpiry: true });
    expect(v.status).toBe("WARNING");
    expect(v.code).toBe("TRIP_DATES_UNKNOWN");
    expect(v.tripEndDate).toBeNull();
  });

  it("использует trip start, когда trip end не передан", () => {
    const v = validatePassportExpiry({ passportExpiry: "2026-01-01", tripStartDate: "2027-01-01", requireExpiry: true });
    expect(v.status).toBe("BLOCK");
    expect(v.tripEndDate).toBe("2027-01-01");
  });

  it("невалидная строка даты трактуется как отсутствие значения", () => {
    const v = validatePassportExpiry({ passportExpiry: "not-a-date", tripEndDate: tripEnd, requireExpiry: true });
    expect(v.status).toBe("BLOCK");
    expect(v.code).toBe("MISSING_PASSPORT_EXPIRY");
  });
});

describe("validateTravelersPassportExpiry (§14 aggregate)", () => {
  const trip = { tripStartDate: "2027-06-01", tripEndDate: "2027-06-30" };

  it("худший статус побеждает: BLOCK > WARNING > OK", () => {
    const mixed = validateTravelersPassportExpiry(
      [
        { id: "t1", passportExpiry: "2030-01-01" },
        { id: "t2", passportExpiry: "2027-07-15" }, // WARNING (в пределах margin)
        { id: "t3", passportExpiry: "2026-01-01" }, // BLOCK
      ],
      trip,
      { requireExpiry: true },
    );
    expect(mixed.status).toBe("BLOCK");
    expect(mixed.verdicts.map((v) => v.status)).toEqual(["OK", "WARNING", "BLOCK"]);
    expect(mixed.verdicts[2].travelerId).toBe("t3");
  });

  it("пустой список → OK", () => {
    expect(validateTravelersPassportExpiry([], trip, { requireExpiry: true }).status).toBe("OK");
  });

  it("requireExpiry наследуется на всех туристов", () => {
    const r = validateTravelersPassportExpiry([{ id: "t1", passportExpiry: null }], trip, { requireExpiry: true });
    expect(r.status).toBe("BLOCK");
    expect(r.verdicts[0].code).toBe("MISSING_PASSPORT_EXPIRY");
  });
});

describe("resolveTripDates (§14)", () => {
  it("берёт min/max по OrderItem.serviceDate и Order.serviceDate", () => {
    const r = resolveTripDates({
      serviceDate: new Date("2027-06-10T00:00:00.000Z"),
      items: [
        { serviceDate: new Date("2027-06-05T00:00:00.000Z") },
        { serviceDate: new Date("2027-06-20T00:00:00.000Z") },
        { serviceDate: null },
      ],
    });
    expect(r.tripStartDate?.toISOString().slice(0, 10)).toBe("2027-06-05");
    expect(r.tripEndDate?.toISOString().slice(0, 10)).toBe("2027-06-20");
  });

  it("нет дат → null/null (вызывающий код получает WARNING, не BLOCK)", () => {
    expect(resolveTripDates({})).toEqual({ tripStartDate: null, tripEndDate: null });
    expect(resolveTripDates({ serviceDate: null, items: [] })).toEqual({ tripStartDate: null, tripEndDate: null });
  });
});
