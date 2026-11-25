// Выбор направления в пикере: открыть панель и посмотреть варианты
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

const trigger = page.locator("button").filter({ hasText: /^Куда/ }).first();
console.log("trigger count:", await trigger.count());
await trigger.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/probe-dest-panel.png` });

const items = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, button, [role=option], li, a").forEach((el) => {
    const t = (el.innerText ?? "").replace(/\s+/g, " ").trim();
    if (t && t.length < 40) out.push({ tag: el.tagName, ph: el.getAttribute("placeholder") ?? "", text: t });
  });
  return out.slice(-30);
});
console.log(JSON.stringify(items, null, 1));
await browser.close();
