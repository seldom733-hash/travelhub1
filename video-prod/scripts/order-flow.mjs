// Проведение заказа: приём, бронь, платёж. Логирует действия на каждом шаге.
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const id = process.argv[2];
const steps = (process.argv[3] ?? "").split(",").filter(Boolean);

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await context.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 150)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.fill('input[autocomplete="username"]', "Natalya");
await page.fill('input[type="password"]', "natalya1234");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);

const dump = async (label) => {
  const buttons = (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean);
  console.log(`[${label}] ${buttons.filter((b) => !["«", "Выйти"].includes(b)).join(" | ")}`);
  await page.screenshot({ path: `${OUT}/ord-${label}.png` });
};

await page.goto(`${BASE}/app/orders/${id}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
await dump("0-initial");

for (const step of steps) {
  const btn = page.getByRole("button", { name: step, exact: true });
  if (!(await btn.count())) { console.log(`-- "${step}" not found`); continue; }
  if (await btn.first().isDisabled()) { console.log(`-- "${step}" disabled`); continue; }
  await btn.first().click();
  await page.waitForTimeout(4500);
  const msg = await page.locator('[role="alert"]').first().innerText().catch(() => "");
  console.log(`-- clicked "${step}"${msg ? " → " + msg.replace(/\s+/g, " ").slice(0, 140) : ""}`);
  await dump(step.replace(/\s+/g, "_"));
}
console.log("ERRORS:", errors.slice(0, 4));
await browser.close();
