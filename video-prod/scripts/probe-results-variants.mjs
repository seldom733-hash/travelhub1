// Поиск варианта URL, дающего таблицу результатов
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

const variants = [
  ["t1", `${BASE}/search?service=tours&from=Baku&to=%D0%9E%D0%90%D0%AD&geoCountry=AE&start=2026-11-18&nights=7&nightsFrom=7&nightsTo=7&end=2026-11-18&adults=2&children=0&live=1`],
  ["t2", `${BASE}/search?service=hotels&from=Baku&to=%D0%9E%D0%90%D0%AD&geoCountry=AE&start=2026-11-18&nights=7&end=2026-11-25&adults=2&children=0`],
  ["t3", `${BASE}/search?service=tours&from=Baku&to=AE&geoCountry=AE&start=2026-11-18&nights=7&end=2026-11-25&adults=2&children=0&hotelCategory=4`],
];

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();

for (const [tag, url] of variants) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(14000);
  const text = (await page.locator("body").innerText()).replace(/\n+/g, " ");
  const found = (text.match(/Найдено:\s*([\d\s]+)/) ?? [])[1] ?? "?";
  const hasTable = /ДАТА ЗАЕЗДА|ДАТА ВЫЕЗДА|НОЧЕЙ/i.test(text);
  console.log(tag, "| найдено:", found.trim(), "| таблица:", hasTable);
  await page.screenshot({ path: `${OUT}/probe-${tag}.png` });
}

await browser.close();
