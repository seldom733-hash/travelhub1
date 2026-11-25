// Авторизованный клиент: выбор даты и подача заявки (витрина и поиск)
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });

async function session() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
  await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="username"]', "turist.8435469@example.com");
  await page.fill('input[type="password"]', "Turist1234!");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3500);
  return page;
}

const shot = async (page, name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

async function pickDate(page) {
  // ждём появления цен в календаре
  for (let i = 0; i < 20; i++) {
    const btn = page.locator("button", { hasText: /\d{1,2}\s?\d{3},\d{2}/ }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(3000); return true; }
    await page.waitForTimeout(1000);
  }
  return false;
}

// витрина
try {
  const page = await session();
  await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  // 2 взрослых, без детей
  await page.locator("select").nth(3).selectOption({ index: 0 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log("date picked:", await pickDate(page));
  await shot(page, "a1-02-date");
  const btn = page.getByRole("button", { name: "Подать заявку" }).first();
  console.log("disabled:", await btn.isDisabled());
  if (!(await btn.isDisabled())) { await btn.click(); await page.waitForTimeout(5000); await shot(page, "a1-03-sent"); }
  await page.close();
} catch (e) { console.log("a1 failed:", e.message.slice(0, 140)); }

// поиск
try {
  const page = await session();
  await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);
  await shot(page, "a2-01-search-auth");
  const first = page.getByRole("link", { name: /Подробнее/ }).first();
  if (await first.count()) { await first.click(); await page.waitForTimeout(4500); }
  console.log("date picked:", await pickDate(page));
  await shot(page, "a2-02-pdp-auth");
  const btn = page.getByRole("button", { name: "Подать заявку" }).first();
  console.log("disabled:", await btn.isDisabled());
  if (!(await btn.isDisabled())) { await btn.click(); await page.waitForTimeout(5000); await shot(page, "a2-03-sent"); }
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot(page, "v1-14-account-requests");
  await page.close();
} catch (e) { console.log("a2 failed:", e.message.slice(0, 140)); }

await browser.close();
console.log("done");
