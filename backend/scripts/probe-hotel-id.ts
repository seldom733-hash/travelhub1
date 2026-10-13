/**
 * Probe: is the HOTEL id space the same between search_tour (hotelDynamic,
 * what geo ingest writes as kind=HOTEL) and search_hotel PRICES (HOTELS=<id>)?
 *
 * After geo ingest the aggregator resolves a selected hotel NAME to
 * SupplierGeoLink kind=HOTEL and the adapter filters upstream
 * (HOTELS=<id>&HOTELS_ANY=0). If the ids differ, name search would break —
 * so: pick a checklist hotel that has baseline rows, request HOTELS=<id>,
 * expect rows of that very hotel.
 *
 * Output: UTF-8 file probe-hotel-id.out.txt.
 */
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { KompasSupplierAdapter } from "../src/modules/supplier/kompas/kompas.adapter";

const BASE = "https://online.az.kompastour.com";
const STATE = "30"; // GE
const CHECKIN = "20261110";
const OUT = path.join(__dirname, "probe-hotel-id.out.txt");

const lines: string[] = [];
const log = (...a: unknown[]) => {
  const s = a.map((x) => String(x)).join(" ");
  lines.push(s);
  console.log(s);
};
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");

async function main() {
  const adapter = new KompasSupplierAdapter();
  const anyA = adapter as unknown as Record<string, (...args: unknown[]) => unknown>;

  const opts = (await adapter.discoverGeoOptions(STATE)) as Array<{
    kind: string;
    externalId: string;
    label: string;
  }>;
  const hotels = opts.filter((o) => o.kind === "HOTEL");
  log(`checklist search_tour STATEINC=${STATE}: hotels=${hotels.length}`);

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
  const baseNames = [...new Set(base.map((r) => r.hotelName).filter(Boolean))] as string[];
  log(`baseline rows=${base.length} hotels=${baseNames.length}: ${baseNames.slice(0, 8).join(" | ")}`);

  const pick =
    hotels.find((h) => baseNames.some((n) => norm(n) === norm(h.label))) ??
    hotels.find((h) => baseNames.some((n) => norm(n).includes(norm(h.label)) || norm(h.label).includes(norm(n))));
  if (!pick) {
    log("VERDICT: no overlap between checklist hotels and baseline rows — cannot probe");
    fs.writeFileSync(OUT, lines.join("\n"), "utf8");
    process.exit(2);
  }
  log(`picked hotel ${pick.externalId} "${pick.label}"`);

  const buildUrl = anyA["buildHotelPricesUrl"] as (o: unknown, p: number) => string;
  const url = buildUrl.call(adapter, {
    stateInc: STATE,
    checkInBeg: CHECKIN,
    checkInEnd: CHECKIN,
    nightsFrom: 3,
    nightsTo: 3,
    adults: 2,
    children: 0,
    hotelExternalId: pick.externalId,
  }, 1);
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
      ) => Promise<Array<{ hotelName?: string; city?: string }>>;
      const rows = await parse.call(adapter, page, raw, STATE);
      const names = [...new Set(rows.map((r) => r.hotelName).filter(Boolean))] as string[];
      log(`filtered rows=${rows.length} hotels=${names.length}: ${names.slice(0, 8).join(" | ")}`);

      const pk = norm(pick.label);
      const ok =
        rows.length > 0 &&
        names.every((n) => norm(n) === pk || norm(n).includes(pk) || pk.includes(norm(n)));
      if (ok) {
        log("VERDICT: PASS — HOTEL ids are shared; tours-derived kind=HOTEL links are safe for hotels");
      } else if (rows.length === 0) {
        log("VERDICT: FAIL — 0 rows with HOTELS=<tours id> (id space differs or no availability)");
      } else {
        log("VERDICT: FAIL — rows are not the picked hotel (wrong id space)");
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
