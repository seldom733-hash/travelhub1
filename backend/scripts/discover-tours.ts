/** Dump TOURINC options per country — the actual "town" dimension in KOMPAS. */
import { chromium } from "playwright";

const BASE = "https://online.az.kompastour.com";

async function main() {
  const state = process.argv[2] ?? "23";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${BASE}/search_tour`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => (window as any).samo?.page_ready === true, { timeout: 15_000 });
  await page.evaluate(() => { document.getElementById("samo_popup")?.remove(); });

  const setSelect = async (name: string, value: string) => {
    await page.evaluate(({ name, value }) => {
      const sel = document.querySelector(`select[name=${name}]`) as HTMLSelectElement | null;
      if (sel) { sel.value = value; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    }, { name, value });
    await page.waitForTimeout(2_000);
  };

  await setSelect("TOWNFROMINC", "1411");
  await setSelect("STATEINC", state);
  await page.waitForTimeout(4_000);

  const tours = await page.evaluate(() => {
    const sel = document.querySelector("select[name=TOURINC]") as HTMLSelectElement | null;
    return sel ? Array.from(sel.options).map((o) => ({ id: o.value, label: (o.textContent ?? "").trim() })) : [];
  });
  console.log(JSON.stringify({ state, tours }, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
