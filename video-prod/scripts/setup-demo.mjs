// Подготовка демо: покупатель + 4 заявки (гость/аккаунт × витрина/поиск)
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
fs.mkdirSync(OUT, { recursive: true });

const BUYER = { email: "demo.turist@example.com", phone: "+994501234567", pass: "Turist1234!" };
const GUEST_TAG = Date.now().toString().slice(-6);

const browser = await chromium.launch({ channel: "chromium" });

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
  await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
  return ctx.newPage();
}
const shot = async (page, name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

async function login(page, user, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="username"]', user);
  await page.fill('input[type="password"]', pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  return page.url();
}

async function pickDate(page) {
  for (let i = 0; i < 25; i++) {
    const btn = page.locator("button", { hasText: /\d{1,2}\s?\d{3},\d{2}/ }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(2500); return true; }
    await page.waitForTimeout(800);
  }
  return false;
}

async function fillGuest(page) {
  const texts = page.locator('input[type="text"]');
  const n = await texts.count();
  await texts.nth(n - 2).fill("Айгюн");
  await texts.nth(n - 1).fill("Мамедова");
  await page.locator('input[type="tel"]').first().fill("+994501234567");
  await page.locator('input[type="email"]').last().fill(`guest.${GUEST_TAG}@example.com`);
}

async function submit(page, tag) {
  const btn = page.getByRole("button", { name: "Подать заявку" }).first();
  const disabled = await btn.isDisabled().catch(() => true);
  console.log(`[${tag}] disabled=${disabled}`);
  if (disabled) return false;
  await btn.click();
  await page.waitForTimeout(5000);
  await shot(page, `${tag}-sent`);
  return true;
}

// 1. регистрация покупателя
try {
  const page = await newPage();
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 120000 });
  await page.fill("#reg-first", "Айгюн");
  await page.fill("#reg-last", "Мамедова");
  await page.fill("#reg-email", BUYER.email);
  await page.fill("#reg-phone", BUYER.phone);
  await page.fill("#reg-pass", BUYER.pass);
  await page.fill("#reg-confirm", BUYER.pass);
  await shot(page, "d1-register");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(6000);
  console.log("register →", page.url());
  await shot(page, "d2-account");
  await page.close();
} catch (e) { console.log("register failed:", e.message.slice(0, 140)); }

// 2. гость: витрина
try {
  const page = await newPage();
  await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  await shot(page, "d3-pdp-guest");
  await pickDate(page);
  await page.evaluate(() => window.scrollBy(0, 420));
  await shot(page, "d4-pdp-options");
  await fillGuest(page);
  await shot(page, "d5-guest-filled");
  await submit(page, "d6-guest-storefront");
  await page.close();
} catch (e) { console.log("guest storefront failed:", e.message.slice(0, 140)); }

// 3. гость: поиск
try {
  const page = await newPage();
  await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);
  await shot(page, "d7-search-results");
  const more = page.getByRole("link", { name: /Подробнее/ }).first();
  if (await more.count()) { await more.click(); await page.waitForTimeout(4000); }
  await pickDate(page);
  await fillGuest(page);
  await submit(page, "d8-guest-search");
  await page.close();
} catch (e) { console.log("guest search failed:", e.message.slice(0, 140)); }

// 4. аккаунт: витрина
try {
  const page = await newPage();
  const url = await login(page, BUYER.email, BUYER.pass);
  console.log("login →", url);
  await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  console.log("date:", await pickDate(page));
  await shot(page, "d9-pdp-auth");
  await submit(page, "d10-auth-storefront");
  await page.close();
} catch (e) { console.log("auth storefront failed:", e.message.slice(0, 140)); }

// 5. аккаунт: поиск
try {
  const page = await newPage();
  await login(page, BUYER.email, BUYER.pass);
  await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);
  const more = page.getByRole("link", { name: /Подробнее/ }).first();
  if (await more.count()) { await more.click(); await page.waitForTimeout(4000); }
  console.log("date:", await pickDate(page));
  await submit(page, "d11-auth-search");
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot(page, "d12-account-orders");
  await page.close();
} catch (e) { console.log("auth search failed:", e.message.slice(0, 140)); }

await browser.close();
console.log("done");
