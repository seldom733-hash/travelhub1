// Селекты карточки витрины: назначение и варианты
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

const selects = await page.locator("select").evaluateAll((els) => els.map((e, i) => ({
  i,
  label: e.closest("label")?.innerText?.replace(/\s+/g, " ").trim().slice(0, 30) ?? "",
  value: e.value,
  opts: Array.from(e.options).map((o) => o.text).slice(0, 8),
})));
console.log(JSON.stringify(selects, null, 1));

// выбрать детей = 1 и посмотреть, появились ли возрасты
await page.locator("select").nth(2).selectOption({ index: 1 }).catch(() => {});
await page.waitForTimeout(1500);
const after = await page.locator("input, select").evaluateAll((els) => els.map((e) => `${e.tagName}:${e.type}`));
console.log("after children=1:", after.join(", "));
await page.screenshot({ path: "C:/Projects/Navitravel/video-prod/shots/video/v1-12-pdp-children.png" });
await browser.close();
