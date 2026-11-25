// Диагностика авторизации клиента на карточке услуги
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "turist.8435469@example.com");
await page.fill('input[type="password"]', "Turist1234!");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(6000);
console.log("after login url:", page.url());
console.log("cookies:", (await ctx.cookies()).map((c) => `${c.name}@${c.domain}`).join(", "));
const ls = await page.evaluate(() => Object.keys(localStorage).map((k) => `${k}=${String(localStorage.getItem(k)).slice(0, 12)}`));
console.log("localStorage:", ls.join(" | "));
console.log("header:", (await page.locator("header").first().innerText()).replace(/\s+/g, " ").slice(0, 160));

await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(4000);
console.log("PDP header:", (await page.locator("header").first().innerText()).replace(/\s+/g, " ").slice(0, 160));
console.log("localStorage after:", (await page.evaluate(() => Object.keys(localStorage))).join(","));
const session = await page.evaluate(async () => {
  const r = await fetch("/api/v1/auth/session", { credentials: "include" }).catch((e) => ({ status: "err " + e.message }));
  return typeof r.status === "number" ? r.status : r.status;
});
console.log("session endpoint:", session);
console.log("ERRORS:", errors.slice(0, 3));
await browser.close();
