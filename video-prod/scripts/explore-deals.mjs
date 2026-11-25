// Разведка Реестра продаж и взаиморасчётов
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const [user, pass] = [process.argv[2] ?? "Natalya", process.argv[3] ?? "natalya1234"];

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', user);
await page.fill('input[type="password"]', pass);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);

await page.goto(`${BASE}/app/finance/deals`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/deals-register.png` });
console.log("BUTTONS:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 40).join(" | "));
const raw = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n");
const at = raw.indexOf("Сумма продаж");
console.log("TEXT:\n" + raw.slice(at >= 0 ? at : 0, (at >= 0 ? at : 0) + 2200));
console.log("ERRORS:", errors.slice(0, 3));
await browser.close();
