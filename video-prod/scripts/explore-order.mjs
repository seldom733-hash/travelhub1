// Разведка карточки заказа: действия и блоки
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const id = process.argv[2];
const user = process.argv[3] ?? "Natalya";
const pass = process.argv[4] ?? "natalya1234";

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await context.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 150)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.fill('input[autocomplete="username"]', user);
await page.fill('input[type="password"]', pass);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);

await page.goto(`${BASE}/app/orders/${id}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);
console.log("URL:", page.url());
console.log("BUTTONS:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));
const headings = await page.locator("h1,h2,h3").allInnerTexts();
console.log("HEADINGS:", headings.join(" | "));
const raw = (await page.locator("main, body").first().innerText()).replace(/\n{2,}/g, "\n");
for (const marker of ["ДАННЫЕ ТУРИСТОВ", "ПЛАТЕЖИ КЛИЕНТА"]) {
  const at = raw.indexOf(marker);
  if (at >= 0) console.log(`\n#### ${marker}\n` + raw.slice(at, at + 1200));
}
console.log("ERRORS:", errors.slice(0, 5));
await page.screenshot({ path: `${OUT}/order-detail.png` });
await browser.close();
