// Типы полей в блоке данных туристов
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "Natalya");
await page.fill('input[type="password"]', "natalya1234");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
await page.goto(`${BASE}/app/orders/${process.argv[2]}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const fields = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, select, textarea").forEach((el, i) => {
    const label = el.closest("label")?.innerText?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
    out.push({ i, tag: el.tagName, type: el.type ?? "", name: el.name ?? "", value: (el.value ?? "").slice(0, 20), label });
  });
  return out;
});
console.log(JSON.stringify(fields, null, 1));
await browser.close();
