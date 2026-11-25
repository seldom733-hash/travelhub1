// Раздел «Платежи клиента» в сделке: строки и действия
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
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

const raw = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n");
for (const m of ["Платежи клиента", "График платежей"]) {
  const at = raw.indexOf(m);
  if (at >= 0) console.log(`\n#### ${m}\n` + raw.slice(at, at + 900));
}
console.log("\nBUTTONS:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));
await page.screenshot({ path: `${OUT}/deal-card-payments.png` });
await browser.close();
