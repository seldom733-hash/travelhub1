import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./nav";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("Payments workspace", () => {
  it("is a real page, not a redirect stub", () => {
    const page = read("app/app/payments/page.tsx");
    expect(page).not.toMatch(/\bredirect\s*\(/);
    expect(page).toContain("OperationsCenterShell");
  });

  it("is reachable from the sidebar", () => {
    expect(NAV_ITEMS.find((item) => item.href === "/app/payments")?.labelKey).toBe("nav.payments");
  });
});
