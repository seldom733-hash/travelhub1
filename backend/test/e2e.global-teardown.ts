/**
 * Jest `globalTeardown`: intentionally leaves the isolated test database in
 * place after the run, so data from a failing run can be inspected/debugged.
 * Cleanliness is guaranteed by globalSetup, which DROPS + recreates the DB at
 * the START of every invocation (works even after a crashed run).
 */
export default async function globalTeardown(): Promise<void> {
  process.stdout.write(
    "[e2e] Test DB left in place for inspection; it will be dropped and recreated on the next e2e run.\n",
  );
}
