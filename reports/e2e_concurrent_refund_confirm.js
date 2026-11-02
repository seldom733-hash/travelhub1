const { chromium } = require("../backend/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
    await p.locator("input[autocomplete=username]").fill("admin");
    await p.locator("input[type=password]").fill("admin123");
    await p.locator("button[type=submit]").click();
    await p.waitForTimeout(700);
    await p.goto("http://127.0.0.1:3000/app/finance/refunds", { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    pages.push(p);
  }
  const a0 = pages[0].getByRole("button", { name: "Подтвердить", exact: true });
  const a1 = pages[1].getByRole("button", { name: "Подтвердить", exact: true });
  await Promise.all([a0.click().catch(() => {}), a1.click().catch(() => {})]);
  await pages[0].waitForTimeout(1500);
  const p0 = pages[0].getByRole("button", { name: "Исполнить", exact: true });
  const p1 = pages[1].getByRole("button", { name: "Исполнить", exact: true });
  console.log("process buttons", await p0.count(), await p1.count());
  await pages[0].reload({ waitUntil: "networkidle" });
  await pages[1].reload({ waitUntil: "networkidle" });
  await pages[0].waitForTimeout(600);
  const q0 = pages[0].getByRole("button", { name: "Исполнить", exact: true });
  const q1 = pages[1].getByRole("button", { name: "Исполнить", exact: true });
  await Promise.all([q0.click().catch(() => {}), q1.click().catch(() => {})]);
  await pages[0].waitForTimeout(1500);
  console.log("done");
  await browser.close();
})();
