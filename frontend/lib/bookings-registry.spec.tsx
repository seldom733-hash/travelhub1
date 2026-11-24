import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./nav";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("retired Bookings registry", () => {
  it("redirects to the canonical deal register", () => {
    expect(read("app/app/bookings/page.tsx")).toContain('redirect("/app/finance/deals")');
  });

  it("is not a sidebar destination", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/app/bookings")).toBe(false);
  });
});
