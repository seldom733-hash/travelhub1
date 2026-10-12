/* Probe #2: does search_hotel render tr.price_info in the DOM via in-page
 * form-fill + search click (like search_tour), or only as a raw injected
 * response? Decides whether the adapter parses DOM or raw HTML.
 */
const { chromium } = require("playwright");

const BASE = process.env.KOMPAS_BASE_URL || "https://online.az.kompastour.com";
const STATEINC = process.argv[2] || "17"; // Turkey
const CHECKIN_BEG = process.argv[3] || "20261024";
const NIGHTS = Number(process.argv[4] || "7");

async function setSamoSelect(page, name, value) {
  await page.evaluate(({ name, value }) => {
    const sel = document.querySelector(`select[name=${name}]`);
    if (!sel) return;
    const opt = Array.from(sel.options).find((o) => o.value === value);
    if (!opt) return;
    sel.value = value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, { name, value });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    locale: "ru-RU",
  });
  const page = await context.newPage();

  // Watch PRICES requests the page itself fires (to learn the auto-generated URL).
  const firedUrls = [];
  page.on("request", (req) => {
    if (req.url().includes("samo_action=PRICES")) firedUrls.push(req.url());
  });

  console.log(`[dom] goto ${BASE}/search_hotel ...`);
  await page.goto(`${BASE}/search_hotel`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => typeof window.samo !== "undefined" && window.samo.page_ready === true, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => { document.getElementById("samo_popup")?.remove(); document.getElementById("samo_popup_mini")?.remove(); });

  // Does the hotel form even have TOWNFROMINC / TOURINC / STATEINC / NIGHTS / ADULT / dates?
  const formFields = await page.evaluate(() => ({
    TOWNFROMINC: !!document.querySelector("select[name=TOWNFROMINC]"),
    TOURINC: !!document.querySelector("select[name=TOURINC]"),
    STATEINC: !!document.querySelector("select[name=STATEINC]"),
    NIGHTS_FROM: !!document.querySelector("select[name=NIGHTS_FROM]"),
    NIGHTS_TILL: !!document.querySelector("select[name=NIGHTS_TILL]"),
    ADULT: !!document.querySelector("select[name=ADULT]"),
    CHILD: !!document.querySelector("select[name=CHILD]"),
    CHECKIN_BEG: !!document.querySelector("input[name=CHECKIN_BEG]"),
    CHECKIN_END: !!document.querySelector("input[name=CHECKIN_END]"),
    searchBtn: !!document.querySelector(".load"),
  }));
  console.log(`[dom] form fields present: ${JSON.stringify(formFields)}`);

  // Fill: STATEINC + nights + adult + dates (occupancy 2 adults).
  await setSamoSelect(page, "STATEINC", STATEINC);
  await page.waitForTimeout(2000);
  const curTown = await page.evaluate(() => document.querySelector("select[name=TOWNFROMINC]")?.value ?? "");
  console.log(`[dom] after STATEINC, TOWNFROMINC=${curTown || "(absent)"}`);
  if (formFields.NIGHTS_FROM) await setSamoSelect(page, "NIGHTS_FROM", String(NIGHTS));
  if (formFields.NIGHTS_TILL) await setSamoSelect(page, "NIGHTS_TILL", String(NIGHTS));
  if (formFields.ADULT) await setSamoSelect(page, "ADULT", "2");
  if (formFields.CHILD) await setSamoSelect(page, "CHILD", "0");
  if (formFields.CHECKIN_BEG && formFields.CHECKIN_END) {
    const endD = new Date(`${CHECKIN_BEG.slice(0,4)}-${CHECKIN_BEG.slice(4,6)}-${CHECKIN_BEG.slice(6,8)}`);
    endD.setDate(endD.getDate() + 1);
    const endStr = `${endD.getFullYear()}${String(endD.getMonth()+1).padStart(2,"0")}${String(endD.getDate()).padStart(2,"0")}`;
    await page.evaluate(({ beg, end }) => {
      for (const [name, val] of [["CHECKIN_BEG", beg], ["CHECKIN_END", end]]) {
        const input = document.querySelector(`input[name=${name}]`);
        if (input) { input.value = val; input.dispatchEvent(new Event("change", { bubbles: true })); }
      }
    }, { beg: CHECKIN_BEG, end: endStr });
  }

  // Click search button.
  console.log(`[dom] clicking .load ...`);
  const btn = await page.$(".load");
  if (btn) { await btn.click({ force: true }); }
  else { console.log(`[dom] NO .load button — cannot trigger in-page search`); }

  await page.waitForSelector("tr.price_info", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const domRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr.price_info"));
    const first = rows[0];
    return {
      count: rows.length,
      firstClass: first?.className ?? "",
      firstHotel: first?.querySelector(".link-hotel")?.textContent?.trim() ?? "",
      firstPrice: first?.querySelector("[data-cat-price]")?.getAttribute("data-converted-price-number") ?? "",
    };
  });
  console.log(`[dom] RENDERED tr.price_info count = ${domRows.count}`);
  if (domRows.count > 0) {
    console.log(`[dom] first row class = ${domRows.firstClass}`);
    console.log(`[dom] first hotel = ${domRows.firstHotel} | price(USD) = ${domRows.firstPrice}`);
  }
  console.log(`[dom] PRICES requests the page fired (${firedUrls.length}):`);
  for (const u of firedUrls.slice(0, 3)) console.log(`[dom]   ${u}`);

  await context.close();
  await browser.close();
})().catch((e) => { console.error("[dom] FATAL", e); process.exit(1); });
