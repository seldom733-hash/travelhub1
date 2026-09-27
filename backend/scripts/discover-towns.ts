/** Dump ALL selects on the KOMPAS search form after country selection. */
import { chromium } from "playwright";

const BASE = "https://online.az.kompastour.com";
const STATE = process.argv[2] ?? "23";

async function main() {
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
  await setSelect("STATEINC", STATE);
  await page.waitForTimeout(4_000);

  const selects = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("select")).map((sel) => ({
      name: sel.getAttribute("name"),
      count: sel.options.length,
      sample: Array.from(sel.options).slice(0, 6).map((o) => ({ v: o.value, t: (o.textContent ?? "").trim().slice(0, 40) })),
    })).filter((s) => s.name && s.count > 1);
  });
  console.log(JSON.stringify(selects, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
