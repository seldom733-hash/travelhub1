// Досъёмка кадров для роликов: витрина, кабинет туриста, реестр под ролями
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
  await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
  return ctx.newPage();
}

async function login(page, user, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[autocomplete="username"]', user);
  await page.fill('input[type="password"]', pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3500);
}

const shot = async (page, name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

// ── Витрина (гость) ──
{
  const page = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, "v1-01-home");

  await page.goto(`${BASE}/catalog`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, "v1-02-catalog");

  await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await shot(page, "v1-03-product");

  // нижняя часть карточки — характеристики
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.62));
  await shot(page, "v1-04-product-attrs");
  await page.close();
}

// ── Кабинет туриста ──
{
  const page = await newPage();
  await login(page, "turist.8435469@example.com", "Turist1234!");
  const url = page.url();
  console.log("tourist landed:", url);
  for (const [name, path] of [
    ["v1-05-account", "/account"],
    ["v1-06-account-orders", "/account/orders"],
    ["v1-07-account-payments", "/account/payments"],
    ["v1-08-account-documents", "/account/documents"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("nav fail", path, e.message.slice(0, 60)));
    await page.waitForTimeout(2000);
    await shot(page, name);
  }
  await page.close();
}

// ── Реестр под ролями ──
for (const [name, user, pass] of [
  ["v2-01-register-admin", "admin", "admin123"],
  ["v2-02-register-natalya", "Natalya", "natalya1234"],
  ["v2-03-register-finance", "finance", "finance1234"],
  ["v2-04-register-director", "director", "director1234"],
  ["v2-05-register-elvira", "Elvira", "elvira1234"],
]) {
  const page = await newPage();
  await login(page, user, pass);
  await page.goto(`${BASE}/app/finance/deals`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);
  await shot(page, name);
  await page.close();
}

await browser.close();
console.log("done");
