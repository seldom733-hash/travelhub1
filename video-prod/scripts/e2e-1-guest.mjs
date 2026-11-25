// E2E шаг 1: гость подаёт заявку с карточки товара
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await context.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);

// выбрать доступную дату с ценой
const dateBtn = page.locator("button", { hasText: /\d\s?\d{3},\d{2}/ }).first();
if (await dateBtn.count()) { await dateBtn.click(); await page.waitForTimeout(1200); console.log("date clicked"); }

const inputs = await page.locator("input").evaluateAll((els) => els.map((e) => ({ type: e.type, ph: e.placeholder, name: e.name })));
console.log("inputs:", JSON.stringify(inputs));

await page.locator('input').nth(0).fill("Айгюн");
await page.locator('input').nth(1).fill("Мамедова");
await page.locator('input').nth(2).fill("+994501234567");
await page.locator('input').nth(3).fill("demo.turist@example.com");
await page.screenshot({ path: `${OUT}/e2e-step1-filled.png` });

await page.getByRole("button", { name: "Подать заявку" }).click();
await page.waitForTimeout(6000);
console.log("after submit url:", page.url());
const text = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n");
console.log("TAIL:\n" + text.slice(0, 1200));
console.log("ERRORS:", errors.slice(0, 6));
await page.screenshot({ path: `${OUT}/e2e-step1-result.png` });
await browser.close();
