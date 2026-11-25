// E2E: регистрация туриста → карточка → заявка. Пишет скриншоты по шагам.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
fs.mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString().slice(-7);
const email = `turist.${stamp}@example.com`;
const phone = `+99450${stamp}`;
const password = "Turist1234!";

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await context.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 150)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); };

// 1. регистрация
await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90000 });
await page.fill("#reg-first", "Айгюн");
await page.fill("#reg-last", "Мамедова");
await page.fill("#reg-email", email);
await page.fill("#reg-phone", phone);
await page.fill("#reg-pass", password);
await page.fill("#reg-confirm", password);
await shot("t1-register-filled");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(6000);
console.log("after register:", page.url(), "| email:", email, "| pass:", password);
await shot("t1-register-result");

// 2. карточка товара
await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);
await shot("t1-pdp");

const cta = page.getByRole("button", { name: "Подать заявку" });
console.log("cta count:", await cta.count(), "disabled:", await cta.count() ? await cta.first().isDisabled() : "n/a");

const formInputs = await page.locator("input").evaluateAll((els) => els.map((e, i) => ({ i, type: e.type, ph: e.placeholder })));
console.log("inputs:", JSON.stringify(formInputs));

if (await cta.count()) {
  const texts = page.locator('input[type="text"]');
  const n = await texts.count();
  if (n >= 2) {
    await texts.nth(n - 2).fill("Айгюн");
    await texts.nth(n - 1).fill("Мамедова");
  }
  await page.locator('input[type="tel"]').first().fill(phone).catch(() => {});
  await page.locator('input[type="email"]').last().fill(email).catch(() => {});
  await shot("t1-request-filled");
  if (!(await cta.first().isDisabled())) {
    await cta.first().click();
    await page.waitForTimeout(6000);
    await shot("t1-request-result");
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    console.log("RESULT:", body.slice(0, 600));
  } else {
    console.log("CTA still disabled");
  }
}
console.log("ERRORS:", errors.slice(0, 5));
await browser.close();
