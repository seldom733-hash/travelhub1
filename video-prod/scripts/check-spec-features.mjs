// Проверка возможностей, заявленных в ТЗ
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const out = {};

// 1. Категории универсального поиска
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(2500);
out.searchTabs = (await page.locator("button").allInnerTexts()).map((t) => t.trim()).filter((t) => ["Туры", "Отели", "Авиабилеты"].includes(t));

// 2. Дети и возраст в поиске
const childSelects = await page.locator("select").evaluateAll((els) => els.map((e) => Array.from(e.options).map((o) => o.text).slice(0, 6)));
out.searchSelects = childSelects;

// 3. Переключение на авиабилеты: фильтры «прямой рейс», «багаж», «туда-обратно»
await page.getByRole("button", { name: "Авиабилеты", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2500);
const flightsText = (await page.locator("body").innerText()).replace(/\n+/g, " ");
out.flightsHasDirect = /прям/i.test(flightsText);
out.flightsHasBaggage = /багаж/i.test(flightsText);
out.flightsHasRoundTrip = /туда/i.test(flightsText);

// 4. Уведомления и распределение
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "Ulviyye");
await page.fill('input[type="password"]', "ulviyye1234");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(4000);
await page.goto(`${BASE}/app/finance/deals`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
out.hasNotifications = /оповещ/i.test(body);
const notif = await page.locator("text=оповещ").first().innerText().catch(() => "");
out.notificationsSample = notif.slice(0, 80);

// 5. Распределение заявок: есть ли страница и правила
await page.goto(`${BASE}/app/sales/assignment`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const assign = (await page.locator("body").innerText()).replace(/\n+/g, " ");
out.assignmentPage = assign.slice(assign.indexOf("Распределение"), assign.indexOf("Распределение") + 200);

console.log(JSON.stringify(out, null, 1));
await browser.close();
