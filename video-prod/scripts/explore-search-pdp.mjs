// Разведка: универсальный поиск и карточка витрины (гость)
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/Projects/Navitravel/backend/package.json");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Projects/Navitravel/video-prod/shots/video";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU" });
await ctx.addInitScript(() => window.localStorage.setItem("travelhub.locale", "ru"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));

// ── универсальный поиск ──
await page.goto(`${BASE}/search?service=tours`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/v1-10-search-form.png` });
const searchText = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n");
console.log("SEARCH TEXT:\n" + searchText.slice(searchText.indexOf("Туры"), searchText.indexOf("Туры") + 1600));
console.log("SEARCH BUTTONS:", (await page.locator("button").allInnerTexts()).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 25).join(" | "));

// ── карточка витрины ──
await page.goto(`${BASE}/products/PRD-00021841`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/v1-11-pdp-guest.png` });
const inputsBefore = await page.locator("input, select").evaluateAll((els) => els.map((e) => `${e.tagName}:${e.type ?? ""}`));
console.log("PDP inputs:", inputsBefore.join(", "));
const submit = page.getByRole("button", { name: "Подать заявку" });
console.log("submit count:", await submit.count(), "disabled:", await submit.count() ? await submit.first().isDisabled() : "n/a");
console.log("ERRORS:", errors.slice(0, 4));
await browser.close();
