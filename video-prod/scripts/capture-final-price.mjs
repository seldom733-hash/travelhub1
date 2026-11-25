// Кадры: финальная сделка, реестр, смена цены
import { createRequire } from "node:module";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";

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

// финальная сделка
{
  const page = await session("admin", "admin123");
  await page.goto(`${BASE}/app/finance/deals/00000008`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/f1-deal-final.png` });
  console.log("buttons:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));

  await page.goto(`${BASE}/app/finance/deals`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/f2-register-four.png` });
  console.log("register shot");
  await page.close();
}

// смена цены по второй сделке
{
  const page = await session("admin", "admin123");
  await page.goto(`${BASE}/app/finance/deals/00000007`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/f3-price-before.png` });
  const btn = page.getByRole("button", { name: "Изменить цену", exact: true }).first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/f4-price-dialog.png` });
    console.log("dialog buttons:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));
    const inputs = await page.locator("input").evaluateAll((els) => els.map((e) => ({ t: e.type, v: e.value })));
    console.log("dialog inputs:", JSON.stringify(inputs));
  }
  await page.close();
}

await browser.close();
