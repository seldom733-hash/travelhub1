/**
 * Probe: hotel-form geo discovery (KompasSupplierAdapter.discoverHotelGeoOptions).
 *
 * Validates the /search_hotel discovery path end-to-end BEFORE the bulk ingest:
 *   - does search_hotel expose select[name=STATEINC] (incl. hotel-only states
 *     absent from the tours form, e.g. BG=45)?
 *   - does the TOWNS checklist widget (div.checklistbox.TOWNS + input.townssearch)
 *     lazy-load on the hotel form?
 *   - does the hotelDynamic dictionary embed over plain HTTP for
 *     /search_hotel?STATEINC=… (no TOWNFROMINC)?
 *
 * Usage: npx ts-node scripts/probe-hotel-geo.ts [stateInc ...]   (default 45 30)
 * Output: UTF-8 file probe-hotel-geo.out.txt (PowerShell mangles Cyrillic).
 */
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { KompasSupplierAdapter } from "../src/modules/supplier/kompas/kompas.adapter";

const OUT = path.join(__dirname, "probe-hotel-geo.out.txt");
const lines: string[] = [];
const log = (...a: unknown[]) => {
  const s = a.map((x) => String(x)).join(" ");
  lines.push(s);
  console.log(s);
};

async function main() {
  const states = process.argv.slice(2).filter(Boolean);
  const toProbe = states.length ? states : ["45", "30"]; // BG (hotel-only), GE (overlap)

  const adapter = new KompasSupplierAdapter();
  let anyFail = false;

  for (const stateInc of toProbe) {
    log(`=== STATEINC=${stateInc} (search_hotel) ===`);
    let opts: Awaited<ReturnType<KompasSupplierAdapter["discoverHotelGeoOptions"]>> = [];
    try {
      opts = await adapter.discoverHotelGeoOptions(stateInc);
    } catch (err) {
      log(`ERROR: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
      anyFail = true;
      continue;
    }
    const towns = opts.filter((o) => o.kind === "TOWN");
    const stars = opts.filter((o) => o.kind === "STAR");
    const hotels = opts.filter((o) => o.kind === "HOTEL");
    log(`options: towns=${towns.length} stars=${stars.length} hotels=${hotels.length}`);
    for (const t of towns) {
      log(`  TOWN\t${t.externalId}\t[${t.parentLabel ?? "-"}]\t${t.label}`);
    }
    if (!towns.length) anyFail = true;
  }

  log(anyFail ? "VERDICT: FAIL — a state produced no TOWN options" : "VERDICT: PASS — hotel-form discovery works");
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  log(`ERROR: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  process.exit(1);
});
