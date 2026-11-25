// Что требует форма платежа: тексты, поля, обязательность
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
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
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "+ Добавить платёж" }).first().click();
await page.waitForTimeout(1500);

const modal = page.locator('form, [role="dialog"]').last();
console.log("MODAL TEXT:\n" + (await modal.innerText()).replace(/\n{2,}/g, "\n").slice(0, 1200));
const detail = await page.evaluate(() => {
  const dlg = document.querySelector('form[data-testid], form, [role="dialog"]');
  const out = [];
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    out.push({ tag: el.tagName, type: el.type, required: el.required, value: el.value, ph: el.placeholder, aria: el.getAttribute("aria-label"), name: el.name });
  });
  return { out, disabled: Array.from(document.querySelectorAll("button")).filter((b) => b.disabled).map((b) => b.innerText.trim()) };
});
console.log(JSON.stringify(detail, null, 1));
await browser.close();
