// Разведка страницы товара: какие кнопки и текст видит гость
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const url = process.argv[2] ?? "/products/anex-1703436";

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await context.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));

await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);
console.log("URL:", page.url());
console.log("TITLE:", await page.title());
const buttons = await page.locator("button, a[role=button], a.button").allInnerTexts().catch(() => []);
console.log("BUTTONS:", buttons.map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 40).join(" | "));
const text = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n");
console.log("TEXT TAIL:\n" + text.slice(1500, 4200));
console.log("ERRORS:", errors.slice(0, 5));
await page.screenshot({ path: "C:/Projects/Navitravel/video-prod/shots/pdp.png" });
await browser.close();
