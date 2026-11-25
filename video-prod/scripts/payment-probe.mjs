// Ручной платёж клиента: состав формы и способы оплаты
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const orderId = process.argv[2];

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "Natalya");
await page.fill('input[type="password"]', "natalya1234");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
await page.goto(`${BASE}/app/orders/${orderId}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

await page.getByRole("button", { name: "Платёж клиента" }).first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/t3-payment-form.png` });

const fields = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, select, textarea, button").forEach((el) => {
    if (el.tagName === "BUTTON") { out.push({ tag: "BUTTON", text: el.innerText.replace(/\s+/g, " ").trim().slice(0, 40) }); return; }
    const label = el.closest("label")?.innerText?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
    const opts = el.tagName === "SELECT" ? Array.from(el.options).map((o) => `${o.value}:${o.text}`) : undefined;
    out.push({ tag: el.tagName, type: el.type ?? "", value: (el.value ?? "").slice(0, 25), label, opts });
  });
  return out.slice(-25);
});
console.log(JSON.stringify(fields, null, 1));
await browser.close();
