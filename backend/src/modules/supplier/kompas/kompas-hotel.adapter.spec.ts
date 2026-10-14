import { KompasHotelAdapter } from "./kompas-hotel.adapter";

/**
 * §HOTEL-CALENDAR windowing.
 *
 * Regression guard for a real production bug (2026-10-14): the original
 * `calendarWindows` advanced the cursor with
 * `cursor.setUTCDate(capped.getUTCDate() + 1)`. `setUTCDate` keeps the cursor's
 * own MONTH, so when a window ended in a LATER month than the cursor started
 * (19 Oct..08 Nov) the cursor was written back to 09 Oct — regressing instead
 * of advancing. The loop then re-emitted the identical 31-day window forever:
 * 40 identical 36 s KOMPAS searches, 24 minutes, and an HTTP timeout for a
 * calendar that had in fact returned all 42 offers in the first window.
 */
describe("KompasHotelAdapter.getPriceCalendar windowing", () => {
  const adapter = new KompasHotelAdapter({} as never);
  const windows = (from: string, to: string): Array<{ from: string; to: string }> =>
    (adapter as never as {
      calendarWindows(f: string, t: string): Array<{ from: string; to: string }>;
    }).calendarWindows(from, to);

  it("cross-month range yields ONE window and terminates (regression)", () => {
    // The exact failing case: start in October, end in November.
    expect(windows("2026-10-19", "2026-11-08")).toEqual([
      { from: "2026-10-19", to: "2026-11-08" },
    ]);
  });

  it("a range longer than the window splits into contiguous non-overlapping windows", () => {
    // 31-day windows: 01 Oct..31 Oct, 01 Nov..01 Dec, 02 Dec..15 Dec.
    expect(windows("2026-10-01", "2026-12-15")).toEqual([
      { from: "2026-10-01", to: "2026-10-31" },
      { from: "2026-11-01", to: "2026-12-01" },
      { from: "2026-12-02", to: "2026-12-15" },
    ]);
  });

  it("windows never overlap and always advance (no infinite loop)", () => {
    const out = windows("2026-10-01", "2027-03-31");
    expect(out.length).toBeGreaterThan(1);
    expect(out.length).toBeLessThanOrEqual(40);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].from > out[i - 1].to).toBe(true);
    }
  });

  it("a single-day range yields one window of that day", () => {
    expect(windows("2026-10-19", "2026-10-19")).toEqual([
      { from: "2026-10-19", to: "2026-10-19" },
    ]);
  });

  it("crosses a year boundary correctly", () => {
    expect(windows("2026-12-01", "2027-01-20")).toEqual([
      { from: "2026-12-01", to: "2026-12-31" },
      { from: "2027-01-01", to: "2027-01-20" },
    ]);
  });

  it("handles a leap-February range", () => {
    expect(windows("2028-02-01", "2028-03-05")).toEqual([
      { from: "2028-02-01", to: "2028-03-02" },
      { from: "2028-03-03", to: "2028-03-05" },
    ]);
  });

  it("returns no windows for a reversed range (defensive, no throw)", () => {
    expect(windows("2026-11-08", "2026-10-19")).toEqual([]);
  });

  it("returns no windows for malformed dates", () => {
    expect(windows("", "2026-11-08")).toEqual([]);
    expect(windows("2026-10-19", "not-a-date")).toEqual([]);
  });
});
