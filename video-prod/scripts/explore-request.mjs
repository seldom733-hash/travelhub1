// Разведка карточки заявки: какие действия доступны роли
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const [user, pass, code, tag] = process.argv.slice(2);
const OUT = "C:/Projects/Navitravel/video-prod/shots";

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
await page.waitForTimeout(3500);

await page.goto(`${BASE}/app/requests/${code}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);
console.log("URL:", page.url());
const buttons = await page.locator("button").allInnerTexts();
console.log("BUTTONS:", buttons.map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));
const text = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n");
console.log("TEXT:\n" + text.slice(0, 1600));
console.log("ERRORS:", errors.slice(0, 5));
await page.screenshot({ path: `${OUT}/req-${tag}.png` });
await browser.close();
