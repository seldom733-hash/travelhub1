// Проведение ручного платежа в карточке сделки
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const seq = process.argv[2] ?? "00000016";
const method = process.argv[3] ?? "cash";
const amount = process.argv[4] ?? "2461.79";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "admin");
await page.fill('input[type="password"]', "admin123");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
await page.goto(`${BASE}/app/finance/deals/${seq}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

await page.getByRole("button", { name: "+ Добавить платёж" }).first().click();
await page.waitForTimeout(1500);
const inputs = page.locator("input");
await inputs.nth(1).fill(amount);
await page.locator("select").first().selectOption(method);
await inputs.nth(2).fill(process.argv[5] ?? "Оплата наличными в офисе");
await page.screenshot({ path: `${OUT}/t3-payment-filled.png` });
await page.getByRole("button", { name: "Создать", exact: true }).click();
await page.waitForTimeout(4000);
const msg = await page.locator('[role="alert"], .text-rose-700, .text-emerald-700').first().innerText().catch(() => "");
console.log("after create:", msg.replace(/\s+/g, " ").slice(0, 160));
await page.screenshot({ path: `${OUT}/t3-payment-created.png` });
console.log("ERRORS:", errors.slice(0, 3));
await browser.close();
