// Кадры результатов по прямым URL (по образцу URL заказчика)
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();

const tours = `${BASE}/search?service=tours&from=Baku&to=%D0%9E%D0%90%D0%AD&geoCountry=AE&start=2026-11-18&nights=7&nightsFrom=7&nightsTo=7&end=2026-11-18&adults=2&children=0`;
await page.goto(tours, { waitUntil: "networkidle", timeout: 180000 });
await page.waitForTimeout(15000);
await page.screenshot({ path: `${OUT}/x2-tours-results.png` });
console.log("tours results shot");
const body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
console.log("has table:", /Найдено/i.test(body), "| sample:", body.slice(body.indexOf("Результаты"), body.indexOf("Результаты") + 160));

await page.evaluate(() => window.scrollBy(0, 320));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/x3-tours-results-filters.png` });

// форма с заполненным направлением (тот же URL, но выше)
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/x1-tours-form.png` });
console.log("tours form shot");

await browser.close();
