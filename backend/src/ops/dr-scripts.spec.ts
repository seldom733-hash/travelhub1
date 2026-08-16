/**
 * Step 2.17A — DR script safety regression tests.
 *
 * These tests exercise the fail-closed guards WITHOUT touching a database:
 * protected/canonical target rejection, missing --yes acknowledgement, and
 * missing checksum sidecar rejection all happen before any DB connection.
 */
import { spawnSync } from "child_process";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

const SCRIPTS = join(process.cwd(), "scripts");

function run(args: string[], env?: Record<string, string>): { status: number; out: string } {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

describe("DR restore drill — fail-closed guards", () => {
  const drill = join(SCRIPTS, "dr-restore-drill.mjs");

  it("refuses a protected/canonical target name", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "travelhub1", "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/REFUSED.*protected\/canonical/i);
  });

  it("refuses a production-like target (suffix _prod)", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "travelhub_prod", "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/REFUSED.*protected\/canonical/i);
  });

  it("refuses a production-like target (suffix _production)", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "myapp_production", "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/REFUSED.*protected\/canonical/i);
  });

  it("refuses template0/template1/postgres targets", () => {
    for (const t of ["template0", "template1", "postgres"]) {
      const r = run([drill, "--backup", "/nonexistent.dump", "--target", t, "--yes"]);
      expect(r.status).not.toBe(0);
      expect(r.out).toMatch(/REFUSED.*protected\/canonical/i);
    }
  });

  it("refuses a target equal to the canonical DB derived from DATABASE_URL", () => {
    // canonical DB from DATABASE_URL is not in the static protected list — the
    // guard must still refuse because it is the actual configured DB.
    const r = run(
      [drill, "--backup", "/nonexistent.dump", "--target", "renamed_canonical", "--yes"],
      { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/renamed_canonical" },
    );
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/REFUSED.*protected\/canonical/i);
  });

  it("refuses without --yes acknowledgement", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "travelhub_dr_drill_test"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/--yes required/i);
  });

  it("refuses a backup artifact without a checksum sidecar", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/missing .*checksum|invalid --backup/i);
  });

  it("refuses a missing --backup argument", () => {
    const r = run([drill, "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/invalid --backup/i);
  });

  it("refuses non-bare target database names", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "bad name;drop", "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/REFUSED/i);
  });

  it("refuses a tampered backup artifact (checksum mismatch)", () => {
    const dir = mkdtempSync(join(tmpdir(), "dr-check-"));
    try {
      const dump = join(dir, "tampered.dump");
      const sha = createHash("sha256").update("original-bytes").digest("hex");
      writeFileSync(dump, "tampered-bytes"); // content differs from checksum
      writeFileSync(dump + ".sha256", sha + "\n");
      const r = run([drill, "--backup", dump, "--target", "travelhub_dr_drill_tamper", "--yes"]);
      expect(r.status).not.toBe(0);
      expect(r.out).toMatch(/checksum mismatch/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("DR backup — artifact integrity", () => {
  const backup = join(SCRIPTS, "dr-backup.mjs");

  it("fails fast (exit != 0) when pg_dump cannot connect", () => {
    // Unreachable host/port → pg_dump must fail → script exits non-zero and
    // no artifact is produced.
    const dir = mkdtempSync(join(tmpdir(), "dr-bk-"));
    try {
      const r = run([backup, "--out", dir], {
        DATABASE_URL: "postgresql://postgres:wrong@127.0.0.1:59999/nonexistent",
      });
      expect(r.status).not.toBe(0);
      expect(r.out).toMatch(/FAILED/i);
      const artifacts = require("fs").readdirSync(dir).filter((f: string) => f.endsWith(".dump"));
      expect(artifacts).toHaveLength(0); // no partial artifact on failure
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
