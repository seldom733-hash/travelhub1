// Универсальный прогон действий в карточке сделки
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const [seq, user, pass, steps] = [process.argv[2], process.argv[3] ?? "admin", process.argv[4] ?? "admin123", (process.argv[5] ?? "").split(",").filter(Boolean)];

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
await page.goto(`${BASE}/app/finance/deals/${seq}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const dump = async (label) => {
  const buttons = (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean);
  console.log(`[${label}] ${buttons.filter((b) => !["«", "Выйти"].includes(b)).join(" | ")}`);
  await page.screenshot({ path: `${OUT}/deal-${label}.png` });
};
await dump("start");

for (const step of steps) {
  if (step.startsWith("traveler:")) {
    const [, first, last, birth, series, number, expiry] = step.split(":");
    await page.getByRole("button", { name: "+ Добавить туриста" }).first().click();
    await page.waitForTimeout(1500);
    const inputs = page.locator("input");
    const types = await inputs.evaluateAll((els) => els.map((e) => e.type));
    console.log(`-- traveler inputs: ${types.join(",")}`);
    const textIdx = types.map((t, i) => (t === "text" ? i : -1)).filter((i) => i >= 0);
    const dateIdx = types.map((t, i) => (t === "date" ? i : -1)).filter((i) => i >= 0);
    await inputs.nth(textIdx.at(-2)).fill(first);
    await inputs.nth(textIdx.at(-1)).fill(last);
    if (dateIdx[0] != null) await inputs.nth(dateIdx[0]).fill(birth);
    if (dateIdx[1] != null && expiry) await inputs.nth(dateIdx[1]).fill(expiry);
    await page.screenshot({ path: `${OUT}/deal-traveler-form.png` });
    await page.getByRole("button", { name: /Сохранить/ }).first().click();
    await page.waitForTimeout(3500);
    console.log(`-- traveler added: ${first} ${last}`);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    continue;
  }
  const btn = page.getByRole("button", { name: step, exact: true }).first();
  if (!(await btn.count())) { console.log(`-- "${step}" not found`); continue; }
  if (await btn.isDisabled()) { console.log(`-- "${step}" disabled`); continue; }
  await btn.click();
  await page.waitForTimeout(4000);
  const msg = await page.locator('[role="alert"]').first().innerText().catch(() => "");
  console.log(`-- clicked "${step}"${msg ? " → " + msg.replace(/\s+/g, " ").slice(0, 120) : ""}`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await dump(step.replace(/[^А-Яа-яA-Za-z0-9]+/g, "_").slice(0, 24));
}
console.log("ERRORS:", errors.slice(0, 3));
await browser.close();
