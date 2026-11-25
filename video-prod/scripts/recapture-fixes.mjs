// Пересъёмка по замечаниям заказчика
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const shot = async (n) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot", n); };

async function fillCombo(placeholder, text) {
  const box = page.getByPlaceholder(placeholder).first();
  if (!(await box.count())) { console.log("no combo", placeholder); return false; }
  await box.click();
  await box.fill(text);
  await page.waitForTimeout(2000);
  const opt = page.locator('[role="option"], li, div').filter({ hasText: new RegExp(`^${text}`) }).first();
  if (await opt.count()) { await opt.click().catch(() => {}); } else { await box.press("Enter"); }
  await page.waitForTimeout(1500);
  return true;
}

// 1. Поиск туров: направление, дети, возраст, результаты
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
console.log("dest:", await fillCombo("Куда", "ОАЭ"));

const sels = page.locator("select");
const cnt = await sels.count();
console.log("selects:", cnt);
// дети: ищем селект, где есть опция «1 ребёнок»
let childIdx = -1;
for (let i = 0; i < cnt; i++) {
  const opts = await sels.nth(i).evaluate((e) => Array.from(e.options).map((o) => o.text));
  if (opts.some((t) => /ребён|ребен/i.test(t))) { childIdx = i; break; }
}
console.log("child select index:", childIdx);
if (childIdx >= 0) {
  await sels.nth(childIdx).selectOption({ index: 1 });
  await page.waitForTimeout(3000);
}
await shot("x1-tours-form");

const labels = await page.locator("label, select, input").evaluateAll((els) =>
  els.map((e) => (e.closest("label")?.innerText ?? e.getAttribute("aria-label") ?? e.getAttribute("placeholder") ?? "").replace(/\s+/g, " ").trim())
    .filter((t) => /возраст/i.test(t)));
console.log("age labels:", JSON.stringify(labels));

const find = page.getByRole("button", { name: /Найти/ }).first();
if (await find.count()) { await find.click(); await page.waitForTimeout(12000); }
await shot("x2-tours-results");
await page.evaluate(() => window.scrollBy(0, 300));
await shot("x3-tours-results-filters");

// 2. Авиабилеты
await page.goto(`${BASE}/search?service=flights`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
console.log("from:", await fillCombo("Выберите город вылета", "Баку"));
console.log("to:", await fillCombo("Выберите город прилёта", "Стамбул"));
await page.waitForTimeout(1500);
await shot("x4-flights-form");
const findF = page.getByRole("button", { name: /Найти/ }).first();
if (await findF.count()) { await findF.click(); await page.waitForTimeout(15000); }
await shot("x5-flights-results");
await page.evaluate(() => window.scrollBy(0, 300));
await shot("x6-flights-results-filters");

// 3. Витрина: Туры и Отели
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.scrollTo(0, 1450));
await shot("x7-storefront-tours");
await page.evaluate(() => window.scrollTo(0, 2500));
await shot("x8-storefront-hotels");

// 4. Кабинет с заявками
const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx2.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await p2.fill('input[autocomplete="username"]', "demo.turist@example.com");
await p2.fill('input[type="password"]', "Turist1234!");
await p2.locator('button[type="submit"]').first().click();
await p2.waitForTimeout(5000);
console.log("account url:", p2.url());
await p2.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
await p2.waitForTimeout(3500);
await p2.screenshot({ path: `${OUT}/x9-account-requests.png` });
console.log("shot x9-account-requests");

await browser.close();
