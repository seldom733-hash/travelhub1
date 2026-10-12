/* Probe KOMPAS search_hotel response format (no login — samo session is anon).
 * Usage: node probe-hotel.cjs [stateInc] [checkinBeg] [nights]
 * Dumps: raw PRICES response head + rendered tr.price_info rows (classes + fields).
 */
const { chromium } = require("playwright");

const BASE = process.env.KOMPAS_BASE_URL || "https://online.az.kompastour.com";
// Countries to probe: user's example (Seychelles) + busy standard ones.
const STATES = (process.argv[2] || "77,17,28").split(",");
const CHECKIN_BEG = process.argv[3] || "20261024";  // user's example date
const NIGHTS = process.argv[4] || "7";
const CHECKIN_END = (() => {
  const d = new Date(`${CHECKIN_BEG.slice(0,4)}-${CHECKIN_BEG.slice(4,6)}-${CHECKIN_BEG.slice(6,8)}`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
})();

function pricesUrl(stateInc) {
  // User's exact example shape: no TOWNFROMINC, TOURINC=0, DYN_SEPARATE=1, FILTER=1, PARTITION_PRICE empty.
  return `${BASE}/search_hotel?samo_action=PRICES&STATEINC=${stateInc}&TOURINC=0&PROGRAMGROUPINC=0`
    + `&CHECKIN_BEG=${CHECKIN_BEG}&NIGHTS_FROM=${NIGHTS}&CHECKIN_END=${CHECKIN_END}&NIGHTS_TILL=${NIGHTS}`
    + `&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&townssearch=0&TOWNS=&STARS_ANY=1&STARS=`
    + `&HOTELS_ANY=1&hotelsearch=0&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=`
    + `&FILTER=1&MOMENT_CONFIRM=0&UFILTER=&HOTELTYPES=&PARTITION_PRICE=&PRICEPAGE=1&DYN_SEPARATE=1`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    locale: "ru-RU",
  });
  const page = await context.newPage();

  for (const STATEINC of STATES) {
    // Capture the raw PRICES XHR/response body.
    let rawPrices = null;
    await page.route("**samo_action=PRICES**", async (route) => {
      const response = await route.fetch();
      rawPrices = await response.text();
      await route.fulfill({ response });
    });

    console.log(`\n================ STATEINC=${STATEINC} ================`);
    await page.goto(`${BASE}/search_hotel`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => typeof window.samo !== "undefined" && window.samo.page_ready === true, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { document.getElementById("samo_popup")?.remove(); document.getElementById("samo_popup_mini")?.remove(); });

    await page.goto(pricesUrl(STATEINC), { waitUntil: "networkidle", timeout: 45000 }).catch((e) => console.log(`[probe] goto PRICES err: ${e.message}`));
    await page.waitForTimeout(2500);

    if (!rawPrices) { console.log(`[probe] raw PRICES response: NOT CAPTURED`); await page.unroute("**samo_action=PRICES**"); continue; }

    // Analyze the RAW injected script: dynamic flow? row class structure? row count?
    const dynamic = rawPrices.includes("#dynamic_");
    const hasStatus = rawPrices.includes("checkDynamicPricesStatus");
    const searchKey = rawPrices.match(/search_key\("([^"]+)"\)/)?.[1] ?? "";
    const trCount = (rawPrices.match(/<tr/g) || []).length;
    const priceInfoCount = (rawPrices.match(/price_info/g) || []).length;

    console.log(`[probe] raw: len=${rawPrices.length} dynamic=${dynamic} checkDynamicPricesStatus=${hasStatus}`);
    console.log(`[probe] search_key=${searchKey}`);
    console.log(`[probe] <tr count=${trCount}  price_info occurrences=${priceInfoCount}`);

    // Dump the first <tr ...> opening tag (row class structure).
    const firstTr = rawPrices.match(/<tr[^>]*class="[^"]*price_info[^"]*"[^>]*>/)?.[0]
      ?? rawPrices.match(/<tr[^>]*>/)?.[0] ?? "";
    console.log(`[probe] first <tr> tag:\n${firstTr}`);

    // Dump ~1600 chars starting at the first price_info row (cells structure).
    const idx = rawPrices.indexOf("price_info");
    if (idx >= 0) {
      console.log(`[probe] --- raw around first price_info ---\n${rawPrices.slice(Math.max(0, idx - 200), idx + 1600)}\n---END---`);
      // Extract ONE FULL row and unescape it to see all <td> cells (price/meal/room).
      const trStart = rawPrices.indexOf("<tr", idx);
      const trEnd = rawPrices.indexOf("<\\/tr>", trStart);
      if (trStart >= 0 && trEnd > trStart) {
        const fullRow = rawPrices.slice(trStart, trEnd + 6)
          .replace(/\\\//g, "/").replace(/\\n/g, "\n").replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
        console.log(`[probe] --- ONE FULL ROW (unescaped) ---\n${fullRow}\n---END FULL ROW---`);
      }
    } else {
      console.log(`[probe] no price_info in raw. head:\n${rawPrices.slice(0, 1200)}\n---END---`);
    }

    await page.unroute("**samo_action=PRICES**");
  }

  await context.close();
  await browser.close();
})().catch((e) => { console.error("[probe] FATAL", e); process.exit(1); });
