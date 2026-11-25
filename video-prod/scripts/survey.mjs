// Обзор стенда: вход под ролью, обход ключевых экранов, скриншоты + ошибки
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots";
const account = process.argv[2] ?? "director";
const password = process.argv[3] ?? "director1234";
const routes = (process.argv[4] ?? "").split(",").filter(Boolean);

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "ru-RU" });
await context.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await context.newPage();

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 200)));

// вход
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.fill('input[autocomplete="username"]', account);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log("after login:", page.url());

const report = [];
for (const route of routes) {
  const before = errors.length;
  const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ status: () => "ERR " + e.message.slice(0, 80) }));
  await page.waitForTimeout(2500);
  const name = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  const file = `${OUT}/${account}${name}.png`;
  await page.screenshot({ path: file, fullPage: false }).catch((e) => console.log("shot fail", route, e.message.slice(0, 80)));
  const heading = await page.locator("h1, h2").first().innerText().catch(() => "");
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 200).replace(/\s+/g, " ");
  report.push({ route, status: String(res?.status?.() ?? "?"), heading: heading.slice(0, 80), errors: errors.slice(before).slice(0, 3), file });
  console.log(`${route} → ${report.at(-1).status} | ${heading.slice(0, 60)} | errs=${errors.length - before}`);
}

fs.writeFileSync(`${OUT}/report-${account}.json`, JSON.stringify(report, null, 2));
await browser.close();
