// Съёмка четырёх заявок: гость/аккаунт × витрина/универсальный поиск
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });

async function session(login) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
  await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
  const page = await ctx.newPage();
  if (login) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[autocomplete="username"]', login[0]);
    await page.fill('input[type="password"]', login[1]);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3500);
  }
  return page;
}

const shot = async (page, name) => {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

async function pickDate(page) {
  const dateBtn = page.locator("button", { hasText: /\d{1,2}\s?\d{3},\d{2}/ }).first();
  if (await dateBtn.count()) { await dateBtn.click(); await page.waitForTimeout(2000); return true; }
  return false;
}

async function fillGuest(page, tag) {
  const texts = page.locator('input[type="text"]');
  const n = await texts.count();
  await texts.nth(n - 2).fill("Айгюн");
  await texts.nth(n - 1).fill("Мамедова");
  await page.locator('input[type="tel"]').first().fill("+994501112233");
  await page.locator('input[type="email"]').last().fill(`guest.${tag}@example.com`);
}

async function submitRequest(page, tag) {
  const btn = page.getByRole("button", { name: "Подать заявку" }).first();
  console.log(`[${tag}] submit disabled:`, await btn.isDisabled());
  await shot(page, `${tag}-ready`);
  await btn.click();
  await page.waitForTimeout(5000);
  await shot(page, `${tag}-sent`);
}

// ── 1. Гость: витрина ──
try {
  const page = await session(null);
  await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  await shot(page, "g1-01-pdp");

  await page.locator("select").nth(3).selectOption({ index: 1 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, "g1-02-children");

  console.log("date picked:", await pickDate(page));
  await page.evaluate(() => window.scrollBy(0, 500));
  await shot(page, "g1-03-date");
  await page.evaluate(() => window.scrollBy(0, 500));
  await shot(page, "g1-04-options");

  await fillGuest(page, "g1");
  await shot(page, "g1-05-filled");
  await submitRequest(page, "g1");
  await page.close();
} catch (e) { console.log("flow g1 failed:", e.message.slice(0, 160)); }

// ── 2. Гость: универсальный поиск ──
try {
  const page = await session(null);
  await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);
  await shot(page, "g2-01-search");

  const first = page.getByRole("link", { name: /Подробнее/ }).first();
  if (await first.count()) { await first.click(); await page.waitForTimeout(4000); }
  else { await page.locator("text=Подробнее").first().click(); await page.waitForTimeout(4000); }
  await shot(page, "g2-02-pdp");

  await pickDate(page);
  await fillGuest(page, "g2");
  await submitRequest(page, "g2");
  await page.close();
} catch (e) { console.log("flow g2 failed:", e.message.slice(0, 160)); }

// ── 3. Аккаунт: витрина ──
try {
  const page = await session(["turist.8435469@example.com", "Turist1234!"]);
  await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  await pickDate(page);
  await shot(page, "a1-01-pdp");
  await submitRequest(page, "a1");
  await page.close();
} catch (e) { console.log("flow a1 failed:", e.message.slice(0, 160)); }

// ── 4. Аккаунт: универсальный поиск ──
try {
  const page = await session(["turist.8435469@example.com", "Turist1234!"]);
  await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);
  await shot(page, "a2-01-search");
  const first = page.getByRole("link", { name: /Подробнее/ }).first();
  if (await first.count()) { await first.click(); await page.waitForTimeout(4000); }
  await pickDate(page);
  await shot(page, "a2-02-pdp");
  await submitRequest(page, "a2");

  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);
  await shot(page, "v1-14-account-requests");
  await page.close();
} catch (e) { console.log("flow a2 failed:", e.message.slice(0, 160)); }

await browser.close();
console.log("done");
