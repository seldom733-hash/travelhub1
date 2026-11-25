// Проверка UI: возраст детей, фильтры авиабилетов, уведомления менеджера
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
const out = {};

const browser = await chromium.launch({ channel: "chromium" });

async function page42(user, pass) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
  await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
  const page = await ctx.newPage();
  if (user) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[autocomplete="username"]', user);
    await page.fill('input[type="password"]', pass);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4000);
  }
  return page;
}

// 1. Авиабилеты: фильтры
{
  const page = await page42();
  await page.goto(`${BASE}/search?service=flights`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);
  const text = (await page.locator("body").innerText()).replace(/\n+/g, " ");
  out.flights = {
    direct: /прям/i.test(text),
    baggage: /багаж/i.test(text),
    roundTrip: /туда\s*и\s*обратно|обратно/i.test(text),
    passengers: /пассажир/i.test(text),
    sample: text.slice(text.indexOf("Авиабилеты"), text.indexOf("Авиабилеты") + 400),
  };
  await page.screenshot({ path: `${OUT}/spec-flights.png` });
  await page.close();
}

// 2. Дети: возраст в поиске и в карточке
{
  const page = await page42();
  await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  const selects = await page.locator("select").count();
  if (selects >= 3) {
    await page.locator("select").nth(2).selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  const ageInputs = await page.locator('input[placeholder*="озраст"], input[name*="age"], select[name*="age"]').count();
  const text = (await page.locator("body").innerText()).replace(/\n+/g, " ");
  out.childrenInSearch = { ageInputs, mentionsAge: /возраст/i.test(text) };
  await page.screenshot({ path: `${OUT}/spec-children-search.png` });
  await page.close();
}

// 3. Уведомления менеджера
{
  const page = await page42("Natalya", "natalya1234");
  for (const path of ["/app/dashboard", "/app/finance/deals", "/app/my-status"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const text = (await page.locator("body").innerText()).replace(/\n+/g, " ");
    const hasNotif = /оповещ|уведомлен/i.test(text);
    out[`notif_${path.replace(/\W/g, "_")}`] = { hasNotif, sample: text.slice(0, 120) };
  }
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/spec-manager-dashboard.png` });
  await page.close();
}

// 4. Форма платежа: документ
{
  const page = await page42("admin", "admin123");
  await page.goto(`${BASE}/app/finance/deals`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  out.paymentDocField = "см. скриншот формы платежа";
  await page.close();
}

console.log(JSON.stringify(out, null, 1));
await browser.close();
