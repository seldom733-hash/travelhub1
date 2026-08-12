import { evaluateRestrictions, type ResolvedPeriodContext, type RestrictionRow } from "./restriction-evaluation";

/**
 * PHASE 1 STEP 1.8D — unit-тесты детерминированного restriction evaluator.
 *
 * Fixed «today» = 2026-08-12 (UTC date-only) — детерминизм.
 * Контракт: caller передаёт ТОЛЬКО ACTIVE rows (архивные фильтрует сервис/query);
 * evaluator принимает resolved period победителя 1.8C (или null → base pricing).
 */
const TODAY = new Date("2026-08-12T00:00:00.000Z");
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const DAY = 86_400_000;

const row = (partial: Partial<RestrictionRow>): RestrictionRow => ({
  id: "r1",
  code: "CRS-00000001",
  scope: "DATE",
  commercialPeriodId: null,
  startDate: null,
  endDate: null,
  type: "STOP_SELL",
  value: null,
  ...partial,
});

const period = (partial: Partial<ResolvedPeriodContext>): ResolvedPeriodContext => ({
  id: "p1",
  code: "CPR-00000001",
  kind: "PERIOD",
  startDate: d("2026-08-01"),
  endDate: d("2026-08-31"),
  sellable: true,
  ...partial,
});

const base = {
  minStay: null,
  maxStay: null,
  advanceBookingDays: null,
  closedToArrival: null,
  closedToDeparture: null,
};

describe("Step 1.8D restriction evaluation (pure)", () => {
  it("sellable when no restrictions apply", () => {
    const r = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 1, base, resolvedPeriod: null, rows: [], today: TODAY });
    expect(r.sellable).toBe(true);
    expect(r.blockedReason).toBeNull();
  });

  it("past service date → fail-closed past_date", () => {
    const r = evaluateRestrictions({ serviceDate: d("2026-08-11"), durationDays: 1, base, resolvedPeriod: null, rows: [], today: TODAY });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("past_date");
  });

  // ── STOP_SELL ─────────────────────────────────────────────────────────────

  it("DATE stop-sell blocks even with sellable period and price", () => {
    const r = evaluateRestrictions({
      serviceDate: d("2026-08-15"),
      durationDays: 1,
      base,
      resolvedPeriod: period({}),
      rows: [row({ id: "s1", code: "CRS-00000002", type: "STOP_SELL", startDate: d("2026-08-15"), endDate: d("2026-08-15") })],
      today: TODAY,
    });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("date_stop_sell");
    // price/availability НЕ трогаются — evaluator возвращает только вердикт.
    expect(r.applied).toEqual([{ type: "STOP_SELL", value: null, source: "DATE", code: "CRS-00000002" }]);
  });

  it("period stop-sell (1.8C sellable=false) blocks; date row reason wins over period", () => {
    const periodOnly = evaluateRestrictions({
      serviceDate: d("2026-08-15"),
      durationDays: 1,
      base,
      resolvedPeriod: period({ sellable: false }),
      rows: [],
      today: TODAY,
    });
    expect(periodOnly.sellable).toBe(false);
    expect(periodOnly.blockedReason).toBe("period_stop_sell");

    const both = evaluateRestrictions({
      serviceDate: d("2026-08-15"),
      durationDays: 1,
      base,
      resolvedPeriod: period({ sellable: false }),
      rows: [row({ id: "s1", code: "CRS-00000002", type: "STOP_SELL", startDate: d("2026-08-15"), endDate: d("2026-08-15") })],
      today: TODAY,
    });
    expect(both.blockedReason).toBe("date_stop_sell"); // более специфичный reason
  });

  it("stop-sell row on another date does not block", () => {
    const r = evaluateRestrictions({
      serviceDate: d("2026-08-15"),
      durationDays: 1,
      base,
      resolvedPeriod: period({}),
      rows: [row({ id: "s1", code: "CRS-00000002", type: "STOP_SELL", startDate: d("2026-08-16"), endDate: d("2026-08-16") })],
      today: TODAY,
    });
    expect(r.sellable).toBe(true);
  });

  // ── MIN_STAY / MAX_STAY ──────────────────────────────────────────────────

  it("minStay below requested duration → min_stay; exact minimum → allowed", () => {
    const below = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 1, base: { ...base, minStay: 2 }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(below.sellable).toBe(false);
    expect(below.blockedReason).toBe("min_stay");
    const exact = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 2, base: { ...base, minStay: 2 }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(exact.sellable).toBe(true);
  });

  it("minStay > 1 without duration → fail-closed min_stay_requires_duration", () => {
    const r = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: null, base: { ...base, minStay: 3 }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("min_stay_requires_duration");
  });

  it("base maxStay exceeded → max_stay", () => {
    const r = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 5, base: { ...base, maxStay: 2 }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("max_stay");
  });

  it("scoped MIN_STAY overrides base (DATE > PERIOD > BASE precedence)", () => {
    const dateWins = evaluateRestrictions({
      serviceDate: d("2026-08-20"),
      durationDays: 4,
      base: { ...base, minStay: 1 },
      resolvedPeriod: period({}),
      rows: [
        row({ id: "pd", code: "CRS-00000003", scope: "PERIOD", type: "MIN_STAY", commercialPeriodId: "p1", value: 2 }),
        row({ id: "dd", code: "CRS-00000004", type: "MIN_STAY", startDate: d("2026-08-20"), endDate: d("2026-08-20"), value: 5 }),
      ],
      today: TODAY,
    });
    expect(dateWins.sellable).toBe(false);
    expect(dateWins.blockedReason).toBe("min_stay");
    expect(dateWins.minStay).toBe(5);

    const periodWinsOverBase = evaluateRestrictions({
      serviceDate: d("2026-08-20"),
      durationDays: 2,
      base: { ...base, minStay: 1 },
      resolvedPeriod: period({}),
      rows: [row({ id: "pd", code: "CRS-00000003", scope: "PERIOD", type: "MIN_STAY", commercialPeriodId: "p1", value: 2 })],
      today: TODAY,
    });
    expect(periodWinsOverBase.sellable).toBe(true);
    expect(periodWinsOverBase.minStay).toBe(2);

    // resolvedPeriod = null → PERIOD row не применяется (base остаётся).
    const noPeriod = evaluateRestrictions({
      serviceDate: d("2026-08-20"),
      durationDays: 1,
      base: { ...base, minStay: 2 },
      resolvedPeriod: null,
      rows: [row({ id: "pd", code: "CRS-00000003", scope: "PERIOD", type: "MIN_STAY", commercialPeriodId: "p1", value: 2 })],
      today: TODAY,
    });
    expect(noPeriod.sellable).toBe(false);
    expect(noPeriod.minStay).toBe(2); // base
  });

  // ── ADVANCE_BOOKING ──────────────────────────────────────────────────────

  it("advance-booking inclusive boundary: serviceDate >= today + N", () => {
    const blocked = evaluateRestrictions({ serviceDate: d("2026-08-14"), durationDays: 1, base: { ...base, advanceBookingDays: 3 }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(blocked.sellable).toBe(false);
    expect(blocked.blockedReason).toBe("advance_booking");
    const boundary = evaluateRestrictions({ serviceDate: d("2026-08-15"), durationDays: 1, base: { ...base, advanceBookingDays: 3 }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(boundary.sellable).toBe(true);
  });

  it("DATE-scope ADVANCE_BOOKING overrides base per date; UTC date-only", () => {
    const dateRow = row({ id: "ad", code: "CRS-00000005", type: "ADVANCE_BOOKING", startDate: d("2026-08-20"), endDate: d("2026-08-20"), value: 10 });
    const onDate = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 1, base: { ...base, advanceBookingDays: 0 }, resolvedPeriod: null, rows: [dateRow], today: TODAY });
    expect(onDate.sellable).toBe(false); // 20 < 22 (12+10) → blocked
    const otherDate = evaluateRestrictions({ serviceDate: d("2026-08-30"), durationDays: 1, base: { ...base, advanceBookingDays: 0 }, resolvedPeriod: null, rows: [dateRow], today: TODAY });
    expect(otherDate.sellable).toBe(true); // 30 >= 22 → allowed (row не применяется)
  });

  // ── CTA / CTD ────────────────────────────────────────────────────────────

  it("CTA blocks arrival/start date; interior CTA does not block a range", () => {
    const ctaRow = row({ id: "cta", code: "CRS-00000006", type: "CLOSED_TO_ARRIVAL", startDate: d("2026-08-20"), endDate: d("2026-08-20") });
    const startBlocked = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 5, base, resolvedPeriod: null, rows: [ctaRow], today: TODAY });
    expect(startBlocked.sellable).toBe(false);
    expect(startBlocked.blockedReason).toBe("closed_to_arrival");

    // CTA на INTERIOR дату диапазона (не start) — НЕ блокирует (test §21.6 #28).
    const interiorCta = row({ id: "cta2", code: "CRS-00000007", type: "CLOSED_TO_ARRIVAL", startDate: d("2026-08-22"), endDate: d("2026-08-22") });
    const range = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 5, base, resolvedPeriod: null, rows: [interiorCta], today: TODAY });
    expect(range.sellable).toBe(true);
  });

  it("CTD blocks departure/end date (start + duration - 1); CTD requires duration (fail-closed)", () => {
    const ctdRow = row({ id: "ctd", code: "CRS-00000008", type: "CLOSED_TO_DEPARTURE", startDate: d("2026-08-24"), endDate: d("2026-08-24") });
    // start 08-20, duration 5 → departure 08-24 → blocked.
    const blocked = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 5, base, resolvedPeriod: null, rows: [ctdRow], today: TODAY });
    expect(blocked.sellable).toBe(false);
    expect(blocked.blockedReason).toBe("closed_to_departure");
    // start 08-20, duration 2 → departure 08-21 → не блокирует.
    const ok = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 2, base, resolvedPeriod: null, rows: [ctdRow], today: TODAY });
    expect(ok.sellable).toBe(true);

    const noDuration = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: null, base: { ...base, closedToDeparture: true }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(noDuration.sellable).toBe(false);
    expect(noDuration.blockedReason).toBe("closed_to_departure_requires_duration");
  });

  it("PERIOD-scope CTD: departure within period blocked; long stay crossing boundary not blocked", () => {
    const p = period({ startDate: d("2026-08-01"), endDate: d("2026-08-25") });
    const ctdPeriod = row({ id: "ctdp", code: "CRS-00000009", scope: "PERIOD", type: "CLOSED_TO_DEPARTURE", commercialPeriodId: "p1" });
    const inside = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 3, base, resolvedPeriod: p, rows: [ctdPeriod], today: TODAY });
    expect(inside.sellable).toBe(false); // departure 08-22 ∈ period
    const crossing = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 10, base, resolvedPeriod: p, rows: [ctdPeriod], today: TODAY });
    expect(crossing.sellable).toBe(true); // departure 08-29 ∉ period
  });

  it("base CTA blocks all arrivals; unsupported dimension = write-time (e2e), evaluator не знает категории", () => {
    const r = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 1, base: { ...base, closedToArrival: true }, resolvedPeriod: null, rows: [], today: TODAY });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("closed_to_arrival");
  });

  // ── Provenance ───────────────────────────────────────────────────────────

  it("explainable provenance: applied list содержит tier-winning факты", () => {
    const r = evaluateRestrictions({
      serviceDate: d("2026-08-20"),
      durationDays: 4,
      base: { ...base, minStay: 1, advanceBookingDays: 2 },
      resolvedPeriod: period({}),
      rows: [row({ id: "pd", code: "CRS-00000003", scope: "PERIOD", type: "MIN_STAY", commercialPeriodId: "p1", value: 3 })],
      today: TODAY,
    });
    expect(r.sellable).toBe(true);
    expect(r.applied).toContainEqual({ type: "MIN_STAY", value: 3, source: "PERIOD", code: "CRS-00000003" });
    expect(r.applied).toContainEqual({ type: "ADVANCE_BOOKING", value: 2, source: "BASE", code: null });
    expect(r.minStay).toBe(3);
    expect(r.advanceBookingDays).toBe(2);
  });

  it("range stop-sell (§42): stop-sold interior required date blocks; start-only без duration", () => {
    const interiorStop = row({ id: "rs", code: "CRS-00000010", type: "STOP_SELL", startDate: d("2026-08-22"), endDate: d("2026-08-22") });
    // start 08-20, duration 5 → диапазон включает 08-22 (interior) → blocked.
    const blocked = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 5, base, resolvedPeriod: null, rows: [interiorStop], today: TODAY });
    expect(blocked.sellable).toBe(false);
    expect(blocked.blockedReason).toBe("date_stop_sell");
    // Без durationDays — только start (08-20 не stop-sold) → allowed.
    const startOnly = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: null, base, resolvedPeriod: null, rows: [interiorStop], today: TODAY });
    expect(startOnly.sellable).toBe(true);
    // Диапазон, не пересекающий stop-дату → allowed.
    const ok = evaluateRestrictions({ serviceDate: d("2026-08-23"), durationDays: 2, base, resolvedPeriod: null, rows: [interiorStop], today: TODAY });
    expect(ok.sellable).toBe(true);
  });

  it("presence override — additive-only: base CTA не может быть явно ослаблен scoped-строкой (documented)", () => {
    // BASE CTA=true блокирует ВСЕ заезды; DATE-scoped CTA на другой дате ничего
    // не «открывает» (нет negative presence override в canonical наборе 1.8D).
    const r = evaluateRestrictions({
      serviceDate: d("2026-08-20"),
      durationDays: 1,
      base: { ...base, closedToArrival: true },
      resolvedPeriod: null,
      rows: [row({ id: "ctaX", code: "CRS-00000011", type: "CLOSED_TO_ARRIVAL", startDate: d("2026-08-25"), endDate: d("2026-08-25") })],
      today: TODAY,
    });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("closed_to_arrival");
  });

  it("composition with 1.8C: period stop-sell + price resolver согласованы (цена не меняется evaluator'ом)", () => {
    const r = evaluateRestrictions({ serviceDate: d("2026-08-20"), durationDays: 1, base, resolvedPeriod: period({ sellable: false, kind: "DATE_OVERRIDE" }), rows: [], today: TODAY });
    expect(r.sellable).toBe(false);
    expect(r.blockedReason).toBe("period_stop_sell");
  });
});
