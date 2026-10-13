/**
 * Probe: is the search_hotel TOWNS id space the same as search_tour's?
 *
 * 1) discoverGeoOptions("30")  → TOWN options from the search_tour checklist
 * 2) searchHotelRows baseline  → city set for GE (no town filter)
 * 3) same PRICES URL with TOWNS=<id>&TOWNS_ANY=0 → city set
 *
 * PASS: filtered rows > 0 and their cities concentrate on the picked town.
 * FAIL: filtered rows = 0 (id space differs) or cities = full baseline set
 *       (TOWNS ignored by search_hotel).
 *
 * Output: UTF-8 file probe-hotel-towns.out.txt (PowerShell mangles Cyrillic).
 */
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { KompasSupplierAdapter } from "../src/modules/supplier/kompas/kompas.adapter";

const BASE = "https://online.az.kompastour.com";
const STATE = "30"; // GE — same id in the tours and hotels dicts
const CHECKIN = "20261110";
const OUT = path.join(__dirname, "probe-hotel-towns.out.txt");

const lines: string[] = [];
const log = (...a: unknown[]) => {
  const s = a.map((x) => String(x)).join(" ");
  lines.push(s);
  console.log(s);
};

async function main() {
  const adapter = new KompasSupplierAdapter();
  const anyA = adapter as unknown as Record<string, (...args: unknown[]) => unknown>;

  // 1. tours-form TOWNS checklist for GE
  const opts = (await adapter.discoverGeoOptions(STATE)) as Array<{
    kind: string;
    externalId: string;
    label: string;
    parentLabel?: string;
  }>;
  const towns = opts.filter((o) => o.kind === "TOWN");
  const stars = opts.filter((o) => o.kind === "STAR");
  const hotels = opts.filter((o) => o.kind === "HOTEL");
  log(`checklist search_tour STATEINC=${STATE}: towns=${towns.length} stars=${stars.length} hotels=${hotels.length}`);
  for (const t of towns) log(`  TOWN\t${t.externalId}\t[${t.parentLabel ?? "-"}]\t${t.label}`);

  // 2. baseline hotel search (no town filter)
  const base = await adapter.searchHotelRows({
    stateInc: STATE,
    checkInBeg: CHECKIN,
    checkInEnd: CHECKIN,
    nightsFrom: 3,
    nightsTo: 3,
    adults: 2,
    children: 0,
    maxPages: 1,
  });
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
  const baseCities = [...new Set(base.map((r) => r.city).filter(Boolean))] as string[];
  log(`baseline rows=${base.length} cities=${baseCities.length}: ${baseCities.join(" | ")}`);

  if (!towns.length) {
    log("VERDICT: NO TOWNS discovered on search_tour → hotel-side discovery required");
    fs.writeFileSync(OUT, lines.join("\n"), "utf8");
    process.exit(2);
  }

  // 3. pick a town that actually has rows in the baseline
  const pick =
    towns.find((t) => baseCities.some((c) => norm(c) === norm(t.label))) ??
    towns.find((t) => baseCities.some((c) => norm(c).includes(norm(t.label)) || norm(t.label).includes(norm(c)))) ??
    towns[0];
  log(`picked town ${pick.externalId} "${pick.label}" group=[${pick.parentLabel ?? "-"}]`);

  const buildUrl = anyA["buildHotelPricesUrl"] as (o: unknown, p: number) => string;
  const url = buildUrl.call(
    adapter,
    { stateInc: STATE, checkInBeg: CHECKIN, checkInEnd: CHECKIN, nightsFrom: 3, nightsTo: 3, adults: 2, children: 0 },
    1,
  ).replace(
    "TOWNS_ANY=1&townssearch=0&TOWNS=",
    `TOWNS_ANY=0&townssearch=0&TOWNS=${pick.externalId}`,
  );
  log(`filtered URL: ${url}`);

  const getBrowser = anyA["getBrowser"] as () => Promise<import("playwright").Browser>;
  const browser = await getBrowser.call(adapter);
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    locale: "ru-RU",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${BASE}/search_hotel`, { waitUntil: "networkidle", timeout: 60_000 });
    await page
      .waitForFunction(
        () => (window as unknown as { samo?: { page_ready?: boolean } }).samo?.page_ready === true,
        { timeout: 15_000 },
      )
      .catch(() => {});

    const raws: string[] = [];
    await page.route("**samo_action=PRICES**", async (route) => {
      try {
        const response = await route.fetch();
        raws.push(await response.text());
        await route.fulfill({ response });
      } catch {
        await route.abort().catch(() => {});
      }
    });
    raws.length = 0;
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const raw = raws[0];
    if (!raw) {
      log("filtered: NO PRICES captured");
    } else {
      const parse = anyA["parseHotelPricesRaw"] as (
        p: import("playwright").Page,
        r: string,
        s: string,
      ) => Promise<Array<{ city?: string }>>;
      const rows = await parse.call(adapter, page, raw, STATE);
      const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))] as string[];
      log(`filtered rows=${rows.length} cities=${cities.length}: ${cities.join(" | ")}`);

      // verdict
      const pk = norm(pick.label);
      const concentrate = cities.length > 0 && cities.every((c) => norm(c) === pk || norm(c).includes(pk) || pk.includes(norm(c)));
      if (rows.length > 0 && concentrate && cities.length < Math.max(baseCities.length, 2)) {
        log("VERDICT: PASS — TOWNS filters search_hotel; id space is shared");
      } else if (rows.length === 0) {
        log("VERDICT: FAIL — 0 rows with TOWNS (id space differs OR no availability)");
      } else if (cities.length >= baseCities.length) {
        log("VERDICT: FAIL — TOWNS ignored (city set unchanged)");
      } else {
        log("VERDICT: AMBIGUOUS — inspect city sets above");
      }
    }
  } finally {
    await context.close().catch(() => {});
    fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  }
  process.exit(0);
}

main().catch((e) => {
  log(`ERROR: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  process.exit(1);
});
