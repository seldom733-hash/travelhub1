import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./nav";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("documents are deal-scoped, not a global registry", () => {
  it("the legacy route redirects to the canonical deal register", () => {
    expect(read("app/app/documents/page.tsx")).toContain('redirect("/app/finance/deals")');
  });

  it("has no global documents item in the sidebar", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/app/documents")).toBe(false);
  });
});
