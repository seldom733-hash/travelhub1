/**
 * Step 2.17B — result artifacts.
 *
 * Stable layout per run:
 *   artifacts/performance/<run-id>/{summary.json, environment.json,
 *   scenario.json, correctness.json}
 *
 * Generated run artifacts are gitignored (unless a small curated fixture is
 * intentionally committed). Only status/duration aggregates are serialized —
 * no headers, tokens or raw Idempotency-Key values.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { sanitizeMetadata } from "./redact";

export interface ArtifactSet {
  summary: Record<string, unknown>;
  environment: Record<string, unknown>;
  scenario: Record<string, unknown>;
  correctness: Record<string, unknown>;
}

export function writeArtifacts(outDir: string, set: ArtifactSet): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const name of ["summary", "environment", "scenario", "correctness"] as const) {
    const file = join(outDir, `${name}.json`);
    const data = sanitizeMetadata(set[name]);
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    written.push(file);
  }
  return written;
}
