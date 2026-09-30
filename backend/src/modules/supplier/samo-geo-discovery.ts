import type { Page } from "playwright";
import type { SupplierGeoOption } from "./supplier.types";
import { parseSamoHotelDynamic } from "./samo-hotel-dict";

/**
 * Shared SAMO geo discovery: extracts the lazy-loaded TOWNS checkbox-list
 * (div.checklistbox.TOWNS) — the city/resort dimension that the supplier's
 * own widget sends as TOWNS=<ids>&TOWNS_ANY=0 (verified supplier captures).
 * Works for any SAMO-based supplier (KOMPAS, SUMMERTOUR, KAZUNION):
 * navigate → set STATEINC → focus townssearch → read checkboxes.
 */
export async function discoverSamoGeoOptions(
  page: Page,
  opts: { baseUrl: string; townFromInc: string; stateInc: string },
): Promise<SupplierGeoOption[]> {
  if (!/^(0|[1-9]\d*)$/.test(opts.stateInc)) return [];
  await page.goto(`${opts.baseUrl}/search_tour`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(
    () => (window as any).samo?.page_ready === true,
    { timeout: 15_000 },
  ).catch(() => {});
  await page.evaluate(() => {
    document.getElementById("samo_popup")?.remove();
    document.getElementById("samo_popup_mini")?.remove();
  });

  const setSelect = async (name: string, value: string) => {
    await page.evaluate(({ name, value }) => {
      const sel = document.querySelector(`select[name=${name}]`) as HTMLSelectElement | null;
      if (sel) { sel.value = value; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    }, { name, value });
    await page.waitForTimeout(2_000);
  };

  await setSelect("TOWNFROMINC", opts.townFromInc);
  // The country list is rebuilt after the departure city changes — wait for
  // the target STATEINC, otherwise the default country's towns get ingested
  // under the requested one.
  const hasState = await page
    .waitForFunction(
      (v) => {
        const sel = document.querySelector("select[name=STATEINC]") as HTMLSelectElement | null;
        return !!sel && Array.from(sel.options).some((o) => o.value === v);
      },
      opts.stateInc,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!hasState) return [];
  await setSelect("STATEINC", opts.stateInc);
  await page.waitForTimeout(4_000);
  const applied = await page.evaluate(() => {
    const sel = document.querySelector("select[name=STATEINC]") as HTMLSelectElement | null;
    return sel?.value ?? "";
  });
  if (applied !== opts.stateInc) return [];

  // Trigger lazy load of the towns checklistbox.
  await page.evaluate(() => {
    const inp = document.querySelector("input.townssearch") as HTMLInputElement | null;
    if (inp) { inp.focus(); inp.click(); }
  });
  await page.waitForTimeout(5_000);

  const items = await page.evaluate(() => {
    const box = document.querySelector("div.checklistbox.TOWNS") as HTMLElement | null;
    if (!box) return [] as { externalId: string; label: string; parentLabel?: string }[];
    const out: { externalId: string; label: string; parentLabel?: string }[] = [];
    const seen = new Set<string>();
    const push = (inp: HTMLInputElement, group?: string) => {
      if (!/^\d+$/.test(inp.value) || seen.has(inp.value)) return;
      seen.add(inp.value);
      out.push({
        externalId: inp.value,
        label: (inp.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        ...(group ? { parentLabel: group } : {}),
      });
    };
    // Hierarchical form: div.groupbox > label.groupname (city/region) +
    // div.groupboxChildren (towns of that group). Group names with no
    // numeric inputs are pure headers and carry no option of their own.
    for (const gb of Array.from(box.querySelectorAll("div.groupbox"))) {
      const name = (gb.querySelector("label.groupname")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim() || undefined;
      for (const inp of Array.from(gb.querySelectorAll("div.groupboxChildren input"))) {
        push(inp as HTMLInputElement, name);
      }
    }
    // Flat form (no groups): towns directly under the checklist.
    for (const inp of Array.from(box.querySelectorAll("input"))) {
      if ((inp as HTMLInputElement).closest("div.groupbox")) continue;
      push(inp as HTMLInputElement);
    }
    return out;
  });
  const townItems: SupplierGeoOption[] = items.map((o) => ({ ...o, kind: "TOWN", countryExternalId: opts.stateInc }));

  // Dimension 2: STARS checklistbox (hotel categories) — the same lazy widget
  // KOMPAS exposes: div.checklistbox.STARS with input[value=<id>] + labels
  // like "5*", "HV-1". Rendered alongside TOWNS after STATEINC is applied.
  // Ingested as kind=STAR (country-only links): the «Категория отеля»
  // dropdown and starKeys resolution both read them.
  const stars = await page.evaluate(() => {
    const box = document.querySelector("div.checklistbox.STARS") as HTMLElement | null;
    if (!box) return [] as { externalId: string; label: string }[];
    const out: { externalId: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const inp of Array.from(box.querySelectorAll("input"))) {
      const el = inp as HTMLInputElement;
      if (!/^\d+$/.test(el.value) || seen.has(el.value)) continue;
      seen.add(el.value);
      out.push({
        externalId: el.value,
        label: (el.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      });
    }
    return out;
  });
  const starItems: SupplierGeoOption[] = stars.map((o) => ({
    ...o,
    kind: "STAR",
    countryExternalId: opts.stateInc,
  }));

  // Dimension 3: hotel dictionary — the form embeds the full hotel list as
  // inline samo.hotelDynamic JSON (verified over plain HTTP for all SAMO
  // suppliers). townKey matches TOWNS externalIds → geo-link in ingest.
  const hotelItems: SupplierGeoOption[] = [];
  try {
    const url =
      `${opts.baseUrl}/search_tour?TOWNFROMINC=${encodeURIComponent(opts.townFromInc)}` +
      (opts.stateInc ? `&STATEINC=${encodeURIComponent(opts.stateInc)}` : "");
    const res = await fetch(url, {
      headers: { "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8" },
    });
    if (res.ok) {
      for (const h of parseSamoHotelDynamic(await res.text())) {
        hotelItems.push({
          externalId: h.id,
          label: h.name,
          kind: "HOTEL",
          countryExternalId: opts.stateInc,
          townKey: h.townKey,
        });
      }
    }
  } catch {
    // Hotel dictionary is additive — discovery still succeeds without it.
  }

  return [...townItems, ...starItems, ...hotelItems];
}
