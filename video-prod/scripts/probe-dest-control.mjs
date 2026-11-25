// Разметка поля «Куда» и городских пикеров
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, button, [role=combobox], [role=option]").forEach((el) => {
    const t = (el.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    const ph = el.getAttribute("placeholder") ?? "";
    const al = el.getAttribute("aria-label") ?? "";
    if (/Куда|Откуда|город|Найти|ОАЭ|Баку/i.test(t + ph + al)) {
      out.push({ tag: el.tagName, type: el.type ?? "", role: el.getAttribute("role"), ph, aria: al, text: t });
    }
  });
  return out.slice(0, 40);
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
