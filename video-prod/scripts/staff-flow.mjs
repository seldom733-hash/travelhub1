// Проведение заявки по стадиям с логированием доступных действий
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const [id, steps] = [process.argv[2], (process.argv[3] ?? "").split(",").filter(Boolean)];

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
  const reqButtons = buttons.filter((b) => !["«", "Выйти"].includes(b));
  console.log(`[${label}] actions: ${reqButtons.join(" | ")}`);
  await page.screenshot({ path: `${OUT}/flow-${label}.png` });
};

await page.goto(`${BASE}/app/requests/${id}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
await dump("0-initial");

for (const step of steps) {
  if (step.startsWith("traveler:")) {
    const [, first, last, birth] = step.split(":");
    await page.getByRole("button", { name: "+ Добавить туриста" }).first().click();
    await page.waitForTimeout(1200);
    const inputs = page.locator('input');
    const cnt = await inputs.count();
    const types = await inputs.evaluateAll((els) => els.map((e) => e.type));
    console.log(`-- traveler form inputs: ${cnt} types=${types.join(",")}`);
    // заполняем последние три поля формы (имя/фамилия/дата)
    const textIdx = types.map((t, i) => (t === "text" ? i : -1)).filter((i) => i >= 0);
    const dateIdx = types.indexOf("date");
    await inputs.nth(textIdx.at(-2)).fill(first);
    await inputs.nth(textIdx.at(-1)).fill(last);
    if (dateIdx >= 0) await inputs.nth(dateIdx).fill(birth);
    await page.screenshot({ path: `${OUT}/flow-traveler-form.png` });
    await page.getByRole("button", { name: /Сохранить/ }).first().click();
    await page.waitForTimeout(3500);
    console.log(`-- traveler added: ${first} ${last}`);
    await dump("traveler-added");
    continue;
  }
  const btn = page.getByRole("button", { name: step, exact: true });
  const cnt = await btn.count();
  if (!cnt) { console.log(`-- "${step}" not found`); continue; }
  if (await btn.first().isDisabled()) { console.log(`-- "${step}" disabled`); continue; }
  await btn.first().click();
  await page.waitForTimeout(4500);
  const msg = await page.locator('[role="alert"], .text-rose-700, .text-emerald-700').first().innerText().catch(() => "");
  console.log(`-- clicked "${step}"${msg ? " → " + msg.replace(/\s+/g, " ").slice(0, 120) : ""}`);
  await dump(step.replace(/\s+/g, "_"));
}
console.log("ERRORS:", errors.slice(0, 5));
await browser.close();
