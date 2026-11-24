import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("Requests route retirement", () => {
  it("redirects to the canonical deal register", () => {
    expect(read("app/app/requests/page.tsx")).toContain('redirect("/app/finance/deals")');
  });
});
