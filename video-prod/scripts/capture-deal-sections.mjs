// Кадры карточки сделки: туристы и расчёты с поставщиком
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
const seq = process.argv[2] ?? "00000016";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "admin");
await page.fill('input[type="password"]', "admin123");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
await page.goto(`${BASE}/app/finance/deals/${seq}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// туристы
await page.getByRole("heading", { name: /Туристы/ }).first().scrollIntoViewIfNeeded().catch(async () => {
  await page.evaluate(() => window.scrollTo(0, 900));
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/v2-06-deal-travelers.png` });
console.log("travelers shot");

// расчёты с поставщиком
await page.getByText("Расчёты с поставщиком").first().scrollIntoViewIfNeeded().catch(() => {});
await page.evaluate(() => window.scrollBy(0, -120));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/v2-07-deal-supplier.png` });
console.log("supplier shot");

await browser.close();
