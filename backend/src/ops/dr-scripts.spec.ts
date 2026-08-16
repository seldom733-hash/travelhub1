/**
 * Step 2.17A — DR script safety regression tests.
 *
 * These tests exercise the fail-closed guards WITHOUT touching a database:
 * protected/canonical target rejection, missing --yes acknowledgement, and
 * missing checksum sidecar rejection all happen before any DB connection.
 */
import { spawnSync } from "child_process";
import { join } from "path";

const SCRIPTS = join(process.cwd(), "scripts");

function run(args: string[]): { status: number; out: string } {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { status: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

describe("DR restore drill — fail-closed guards", () => {
  const drill = join(SCRIPTS, "dr-restore-drill.mjs");

  it("refuses a protected/canonical target name", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "travelhub1", "--yes"]);
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

  it("refuses non-bare target database names", () => {
    const r = run([drill, "--backup", "/nonexistent.dump", "--target", "bad name;drop", "--yes"]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/REFUSED/i);
  });
});
