// Кадры под ТЗ: отели, авиабилеты с фильтрами, результаты поиска с фильтрами
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();

// отели
await page.goto(`${BASE}/search?service=hotels`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/s1-search-hotels.png` });
console.log("hotels shot");

// авиабилеты с фильтрами
await page.goto(`${BASE}/search?service=flights`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/s2-search-flights.png` });
console.log("flights shot");

// туры: результаты с таблицей
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/s3-search-results.png` });
await page.evaluate(() => window.scrollBy(0, 700));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/s4-search-results-filters.png` });
console.log("results shots");

// витрина: разделы
await page.goto(`${BASE}/catalog`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/s5-storefront-catalog.png` });
console.log("catalog shot");

await browser.close();
