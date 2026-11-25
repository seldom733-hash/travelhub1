// Подписи полей формы добавления туриста в сделке
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
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
await page.waitForTimeout(3000);

await page.getByRole("button", { name: "+ Добавить туриста" }).first().click();
await page.waitForTimeout(1500);
const fields = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, select, textarea").forEach((el, i) => {
    const label = el.closest("label")?.innerText?.replace(/\s+/g, " ").trim().slice(0, 40)
      ?? el.getAttribute("placeholder") ?? "";
    out.push({ i, tag: el.tagName, type: el.type ?? "", label, required: el.required });
  });
  return out;
});
console.log(JSON.stringify(fields, null, 1));
await page.screenshot({ path: "C:/Projects/Navitravel/video-prod/shots/video/deal-traveler-add.png" });
await browser.close();
