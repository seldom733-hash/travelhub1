import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, ROUTE_ACCESS, isNavActive } from "./nav";
import { t } from "./i18n";
import { PERMISSION_LABELS } from "./permission-labels";

const ROOT = process.cwd();

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFiles(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

function hrefToPage(href: string): string {
  const clean = href.split("?")[0].replace(/^\//, "");
  return path.join(ROOT, "app", clean, "page.tsx");
}

describe("navigation integrity", () => {
  it("has the approved v2 shape", () => {
    expect(NAV_ITEMS).toHaveLength(30);
    expect(NAV_GROUPS).toHaveLength(10);
    expect(NAV_GROUPS.filter((group) => group.headingKey)).toHaveLength(9);
  });

  it("has no duplicate hrefs or label keys", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    const labels = NAV_ITEMS.map((item) => item.labelKey);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("every nav href points to a real, non-redirect page", () => {
    const allPages = new Set(pageFiles(path.join(ROOT, "app", "app")).map((file) => path.resolve(file)));
    for (const item of NAV_ITEMS) {
      const page = hrefToPage(item.href);
      expect(allPages.has(path.resolve(page)), `missing page for ${item.href}`).toBe(true);
      const source = readFileSync(page, "utf8");
      expect(source, `redirect stub used by nav: ${item.href}`).not.toMatch(/\bredirect\s*\(/);
    }
  });

  it("every label and group heading resolves in RU/AZ/EN", () => {
    for (const locale of ["ru", "az", "en"] as const) {
      for (const item of NAV_ITEMS) {
        expect(t(item.labelKey, locale), `${item.labelKey} @ ${locale}`).not.toBe(item.labelKey);
      }
      for (const group of NAV_GROUPS) {
        if (!group.headingKey) continue;
        expect(t(group.headingKey, locale), `${group.headingKey} @ ${locale}`).not.toBe(group.headingKey);
      }
    }
  });

  it("every permission is in the display catalog", () => {
    const codes = [...new Set(NAV_ITEMS.flatMap((item) => item.permissions ?? []))];
    for (const code of codes) {
      expect(PERMISSION_LABELS[code]?.ru, `missing label for ${code}`).toBeTruthy();
    }
  });

  it("every nav href has a route access rule", () => {
    for (const item of NAV_ITEMS) {
      const match = ROUTE_ACCESS.find(
        (rule) => item.href === rule.prefix || item.href.startsWith(`${rule.prefix}/`),
      );
      expect(match, `missing ROUTE_ACCESS for ${item.href}`).toBeTruthy();
    }
  });

  it("resolves exactly one active nav item for every nav href", () => {
    for (const item of NAV_ITEMS) {
      const active = NAV_ITEMS.filter((candidate) => isNavActive(candidate, item.href));
      expect(active, `ambiguous active item for ${item.href}: ${active.map((a) => a.href).join(",")}`).toHaveLength(1);
    }
  });
});
