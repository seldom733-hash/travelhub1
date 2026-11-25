// Кадры под менеджера Ulviyye (владелец сделки) и под чужого менеджера Natalya (только просмотр)
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
const seq = "00000016";

const browser = await chromium.launch({ channel: "chromium" });

async function session(user, pass) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
  await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="username"]', user);
  await page.fill('input[type="password"]', pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3500);
  return page;
}

// владелец
{
  const page = await session("Ulviyye", "ulviyye1234");
  await page.goto(`${BASE}/app/finance/deals`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/v2-08-register-ulviyye.png` });
  console.log("register ulviyye");

  await page.goto(`${BASE}/app/finance/deals/${seq}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/v2-09-deal-ulviyye.png` });
  console.log("deal ulviyye");

  await page.getByRole("heading", { name: /Туристы/ }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/v2-10-travelers-ulviyye.png` });
  console.log("travelers ulviyye");

  await page.getByRole("button", { name: "+ Добавить платёж" }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/v2-11-payment-ulviyye.png` });
  console.log("payment ulviyye");
  await page.close();
}

// чужой менеджер
{
  const page = await session("Natalya", "natalya1234");
  await page.goto(`${BASE}/app/finance/deals/${seq}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/v2-12-deal-foreign.png` });
  console.log("deal foreign (Natalya)");
  await page.close();
}

await browser.close();
