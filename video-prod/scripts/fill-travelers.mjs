// Заполнение данных туристов и финальное подтверждение
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const orderId = process.argv[2];

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "Natalya");
await page.fill('input[type="password"]', "natalya1234");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
await page.goto(`${BASE}/app/orders/${orderId}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const people = [
  { idx: 0, citizenship: "Азербайджан", series: "AZE", number: "1234567", expiry: "2030-05-01" },
  { idx: 1, citizenship: "Азербайджан", series: "AZE", number: "7654321", expiry: "2031-09-15" },
];

for (const p of people) {
  const base = p.idx * 7;
  const inputs = page.locator("input");
  await inputs.nth(base + 3).fill(p.citizenship);
  await inputs.nth(base + 4).fill(p.series);
  await inputs.nth(base + 5).fill(p.number);
  await inputs.nth(base + 6).fill(p.expiry);
  await page.waitForTimeout(300);
  const save = page.getByRole("button", { name: "Сохранить", exact: true }).nth(p.idx);
  await save.click();
  await page.waitForTimeout(3000);
  const msg = await page.locator('[role="alert"], .text-rose-700, .text-emerald-700').first().innerText().catch(() => "");
  console.log(`traveler ${p.idx + 1} saved${msg ? " → " + msg.replace(/\s+/g, " ").slice(0, 120) : ""}`);
}
await page.screenshot({ path: `${OUT}/t2-travelers-filled.png` });

const finalBtn = page.getByRole("button", { name: "Финальное подтверждение" });
console.log("final confirm found:", await finalBtn.count(), "disabled:", await finalBtn.count() ? await finalBtn.first().isDisabled() : "n/a");
if (await finalBtn.count() && !(await finalBtn.first().isDisabled())) {
  await finalBtn.first().click();
  await page.waitForTimeout(4000);
  console.log("after final confirm buttons:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));
  await page.screenshot({ path: `${OUT}/t2-final-confirmed.png` });
}
console.log("ERRORS:", errors.slice(0, 3));
await browser.close();
