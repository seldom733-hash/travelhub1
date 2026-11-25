import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("documents registry — server-side search & sort", () => {
  const src = read("app/app/documents/page.tsx");

  it("uses server-side q/sort params instead of page-local filtering", () => {
    expect(src).toContain("documentsApi.list");
    expect(src).toContain("q: search || undefined");
    expect(src).toContain("sortBy,");
    expect(src).toContain("sortDirection,");
  });

  it("does not retain the old page-local search/sort helpers", () => {
    expect(src).not.toContain("const filteredItems");
    expect(src).not.toContain("const sortedItems");
    expect(src).not.toContain("function keyOf");
  });
});
