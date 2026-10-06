/**
 * Phase 5 §5.9/§5.11 — pricing debug artifacts removed.
 *
 * The interim report audit flagged a raw `fs.appendFileSync("D:\\travelhub_v1\
 * \\backend_price_chain.log", ...)` chain log and unstructured `console.log`
 * traces in the pricing/supplier modules. Debug artifacts must stay gone:
 * operational logging goes through the Nest Logger only.
 */
import * as fs from "fs";
import * as path from "path";

const ROOTS = [path.join(__dirname, "..", "supplier"), __dirname];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("pricing/supplier modules — debug artifacts removed (§5.9)", () => {
  const files = ROOTS.flatMap((root) => walk(root));

  it("scans a non-empty source set", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no raw backend_price_chain.log / appendFileSync writers", () => {
    const offenders = files.filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return /backend_price_chain|appendFileSync/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("no unstructured console.* debugging — Nest Logger only", () => {
    const offenders = files.filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return /console\.(log|warn|error|debug|info)\s*\(/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
