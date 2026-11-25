// Форма «+ Добавить платёж» в карточке сделки: поля и способы оплаты
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

const btns = page.getByRole("button", { name: "+ Добавить платёж" });
console.log("payment buttons:", await btns.count());
await btns.first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/t3-deal-payment-form.png` });

const fields = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    const label = el.closest("label")?.innerText?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
    const opts = el.tagName === "SELECT" ? Array.from(el.options).map((o) => `${o.value}:${o.text}`) : undefined;
    out.push({ tag: el.tagName, type: el.type ?? "", value: (el.value ?? "").slice(0, 30), label, opts });
  });
  return out;
});
console.log(JSON.stringify(fields, null, 1));
const modalBtns = await page.locator('[role="dialog"] button, .fixed button').allInnerTexts().catch(() => []);
console.log("MODAL BUTTONS:", modalBtns.map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));
await browser.close();
