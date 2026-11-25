// Авиабилеты с городами, разделы витрины, кабинет с заявками
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

// Авиабилеты: открыть пикеры и выбрать города
await page.goto(`${BASE}/search?service=flights`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

async function pickCity(re, city) {
  const trigger = page.locator("button").filter({ hasText: re }).first();
  if (!(await trigger.count())) { console.log("no trigger", city); return; }
  await trigger.evaluate((el) => el.click());
  await page.waitForTimeout(1500);
  const opt = page.locator("button, li").filter({ hasText: new RegExp(city) }).first();
  if (await opt.count()) { await opt.evaluate((el) => el.click()); console.log("picked", city); }
  else console.log("no option", city);
  await page.waitForTimeout(1500);
}

await pickCity(/Выберите город вылета/, "Баку");
await pickCity(/Выберите город прилёта/, "Стамбул");
await shot("x4-flights-form");

const findF = page.getByRole("button", { name: /Найти/ }).first();
if (await findF.count() && !(await findF.isDisabled())) {
  await findF.click();
  await page.waitForTimeout(18000);
}
await shot("x5-flights-results");
await page.evaluate(() => window.scrollBy(0, 300));
await shot("x6-flights-filters");

// Витрина: Туры и Отели
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.scrollTo(0, 1450));
await shot("x7-storefront-tours");
await page.evaluate(() => window.scrollTo(0, 2500));
await shot("x8-storefront-hotels");

// Кабинет с заявками
const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx2.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await p2.fill('input[autocomplete="username"]', "demo.turist@example.com");
await p2.fill('input[type="password"]', "Turist1234!");
await p2.locator('button[type="submit"]').first().click();
await p2.waitForTimeout(5000);
await p2.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
await p2.waitForTimeout(3500);
await p2.screenshot({ path: `${OUT}/x9-account-requests.png` });
console.log("shot x9");

await browser.close();
