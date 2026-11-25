// Кадры оплаты: ожидает → подтверждено (в карточке сделки)
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
const seq = process.argv[2] ?? "00000008";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "admin");
await page.fill('input[type="password"]', "admin123");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3500);
await page.goto(`${BASE}/app/finance/deals/${seq}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);

// секция платежей
await page.getByText("Платежи клиента").first().scrollIntoViewIfNeeded().catch(() => {});
await page.evaluate(() => window.scrollBy(0, -160));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/p1-payment-pending.png` });
console.log("pending shot");

const confirm = page.getByRole("button", { name: "Подтвердить", exact: true }).first();
console.log("confirm found:", await confirm.count());
if (await confirm.count()) {
  await confirm.click();
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.getByText("Платежи клиента").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => window.scrollBy(0, -160));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/p2-payment-done.png` });
  console.log("done shot");
}
await browser.close();
