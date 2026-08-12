import { resolveApplicablePeriod, samePriorityOverlap, applicablePeriods, periodDayCount } from "./period-resolution";
import type { PeriodRow } from "./period-resolution";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function row(overrides: Omit<Partial<PeriodRow>, "price"> & { id: string; startDate: Date; endDate: Date; price: number }): PeriodRow {
  return {
    code: `CPR-${overrides.id.slice(0, 8)}`,
    kind: overrides.kind ?? "PERIOD",
    dayOfWeek: overrides.dayOfWeek ?? [],
    sellable: overrides.sellable ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
    price: { toNumber: () => overrides.price, toString: () => overrides.price.toFixed(2) },
  };
}

describe("period-resolution (Step 1.8C)", () => {
  it("periodDayCount: inclusive calendar days (1-day, range, leap year)", () => {
    expect(periodDayCount(d("2026-07-12"), d("2026-07-12"))).toBe(1);
    expect(periodDayCount(d("2026-07-10"), d("2026-07-15"))).toBe(6);
    expect(periodDayCount(d("2028-02-28"), d("2028-02-29"))).toBe(2); // leap
    expect(periodDayCount(d("2026-12-21"), d("2027-01-05"))).toBe(16); // year boundary
  });

  it("applicablePeriods: date-only inclusive (start <= D <= end)", () => {
    const p = row({ id: "a", startDate: d("2026-07-01"), endDate: d("2026-07-31"), price: 100 });
    expect(applicablePeriods([p], d("2026-06-30"))).toHaveLength(0);
    expect(applicablePeriods([p], d("2026-07-01"))).toHaveLength(1);
    expect(applicablePeriods([p], d("2026-07-31"))).toHaveLength(1);
    expect(applicablePeriods([p], d("2026-08-01"))).toHaveLength(0);
  });

  it("DAY_OF_WEEK condition (0=Sunday..6=Saturday, JS getUTCDay) filters by weekday", () => {
    const weekend = row({ id: "w", startDate: d("2026-06-01"), endDate: d("2026-08-31"), dayOfWeek: [0, 6], price: 250 });
    // 2026-07-12 is a Sunday (getUTCDay=0).
    expect(new Date("2026-07-12T00:00:00Z").getUTCDay()).toBe(0);
    expect(applicablePeriods([weekend], d("2026-07-12"))).toHaveLength(1);
    // 2026-07-13 is Monday (getUTCDay=1).
    expect(applicablePeriods([weekend], d("2026-07-13"))).toHaveLength(0);
  });

  it("DD-026 precedence: DATE_OVERRIDE > narrower PERIOD > broader PERIOD; Jul 12 → 260", () => {
    const broad = row({ id: "b", startDate: d("2026-06-01"), endDate: d("2026-08-31"), price: 190 });
    const narrow = row({ id: "n", startDate: d("2026-07-10"), endDate: d("2026-07-15"), price: 230 });
    const override = row({ id: "o", kind: "DATE_OVERRIDE", startDate: d("2026-07-12"), endDate: d("2026-07-12"), price: 260 });
    // Jul 12: override wins.
    expect(resolveApplicablePeriod([broad, narrow, override], d("2026-07-12"))?.id).toBe("o");
    // Jul 14: narrow wins over broad.
    expect(resolveApplicablePeriod([broad, narrow, override], d("2026-07-14"))?.id).toBe("n");
    // Jul 20: only broad applies → base season.
    expect(resolveApplicablePeriod([broad, narrow, override], d("2026-07-20"))?.id).toBe("b");
    // Sep 1: no period → null (base fallback).
    expect(resolveApplicablePeriod([broad, narrow, override], d("2026-09-01"))).toBeNull();
  });

  it("DAY_OF_WEEK-conditioned period of the same range beats the bare period (Universal STRICT REVIEW)", () => {
    const bare = row({ id: "bare", startDate: d("2026-06-01"), endDate: d("2026-08-31"), price: 190 });
    const weekend = row({ id: "wknd", startDate: d("2026-06-01"), endDate: d("2026-08-31"), dayOfWeek: [0, 6], price: 250 });
    // Sunday Jul 12 → weekend price.
    expect(resolveApplicablePeriod([bare, weekend], d("2026-07-12"))?.id).toBe("wknd");
    // Monday Jul 13 → bare (weekend condition not applicable).
    expect(resolveApplicablePeriod([bare, weekend], d("2026-07-13"))?.id).toBe("bare");
  });

  it("same-specificity overlap → conflict detection (write-time 422)", () => {
    const a = row({ id: "a", startDate: d("2026-07-10"), endDate: d("2026-07-15"), price: 230 });
    const b = row({ id: "b", startDate: d("2026-07-12"), endDate: d("2026-07-17"), price: 240 });
    expect(samePriorityOverlap(a, b)).toBe(true); // 6d vs 6d, both PERIOD, no DOW
    const c = row({ id: "c", startDate: d("2026-06-01"), endDate: d("2026-08-31"), price: 190 });
    expect(samePriorityOverlap(a, c)).toBe(false); // different width → deterministic (narrower wins)
    const d1 = row({ id: "d1", kind: "DATE_OVERRIDE", startDate: d("2026-07-12"), endDate: d("2026-07-12"), price: 260 });
    const d2 = row({ id: "d2", kind: "DATE_OVERRIDE", startDate: d("2026-07-12"), endDate: d("2026-07-12"), price: 270 });
    expect(samePriorityOverlap(d1, d2)).toBe(true);
    expect(samePriorityOverlap(d1, a)).toBe(false); // override vs period → allowed (override wins)
    // DOW changes specificity: same range, one with condition → different priority.
    const w = row({ id: "w", startDate: d("2026-07-10"), endDate: d("2026-07-15"), dayOfWeek: [0, 6], price: 250 });
    expect(samePriorityOverlap(a, w)).toBe(false);
  });

  it("deterministic tie-break (createdAt asc, id asc) never throws on equal specificity", () => {
    const a = row({ id: "aaa", startDate: d("2026-07-10"), endDate: d("2026-07-15"), price: 230, createdAt: new Date("2026-01-01T00:00:00Z") });
    const b = row({ id: "bbb", startDate: d("2026-07-10"), endDate: d("2026-07-15"), price: 240, createdAt: new Date("2026-01-02T00:00:00Z") });
    // Write-time validation would reject this, but resolver stays deterministic.
    const winner = resolveApplicablePeriod([a, b], d("2026-07-12"));
    expect(winner?.id).toBe("aaa");
  });

  it("non-sellable period still resolves (price fact preserved; sellability separate)", () => {
    const stopSell = row({ id: "ss", startDate: d("2026-07-01"), endDate: d("2026-07-31"), price: 190, sellable: false });
    const winner = resolveApplicablePeriod([stopSell], d("2026-07-12"));
    expect(winner?.id).toBe("ss");
    expect(winner?.sellable).toBe(false);
  });
});
