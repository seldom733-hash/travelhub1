// Корректная съёмка: направление, дети с возрастом, таблица результатов, авиабилеты
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const shot = async (n) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot", n); };

// ── Туры: направление ──
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
await page.locator("button").filter({ hasText: /^Куда/ }).first().click();
await page.waitForTimeout(1500);
const country = page.locator("button").filter({ hasText: /Турция/ }).first();
console.log("country found:", await country.count());
if (await country.count()) { await country.evaluate((el) => el.click()); }
await page.waitForTimeout(2500);
await shot("x1-tours-form");

// дети = 1 → возраст
const selects = page.locator("select");
const cnt = await selects.count();
console.log("selects:", cnt);
for (let i = 0; i < cnt; i++) {
  const opts = await selects.nth(i).evaluate((e) => Array.from(e.options).map((o) => o.text));
  if (opts.some((t) => /ребён|ребен/i.test(t))) {
    await selects.nth(i).selectOption({ index: 1 });
    console.log("children set on select", i);
    break;
  }
}
await page.waitForTimeout(3000);
await shot("x1b-tours-form-children");

const ageInfo = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("select").forEach((s) => out.push(Array.from(s.options).map((o) => o.text).slice(0, 5)));
  return out;
});
console.log("selects after children:", JSON.stringify(ageInfo));

// поиск
const find = page.getByRole("button", { name: /Найти/ }).first();
console.log("find disabled:", await find.isDisabled().catch(() => "n/a"));
if (!(await find.isDisabled())) { await find.click(); await page.waitForTimeout(15000); }
await shot("x2-tours-results");
await page.evaluate(() => window.scrollBy(0, 320));
await shot("x3-tours-results-filters");

await browser.close();
