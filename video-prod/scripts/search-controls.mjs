// Состав формы универсального поиска
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(2500);

const controls = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, select, button").forEach((el) => {
    const label = el.closest("label")?.innerText?.replace(/\s+/g, " ").trim().slice(0, 30)
      ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? "";
    const opts = el.tagName === "SELECT" ? Array.from(el.options).map((o) => o.text).slice(0, 6) : undefined;
    out.push({ tag: el.tagName, type: el.type ?? "", label, opts });
  });
  return out.slice(0, 30);
});
console.log(JSON.stringify(controls, null, 1));
await browser.close();
