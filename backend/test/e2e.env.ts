/**
 * Jest `setupFiles` entry: runs in every e2e spec worker BEFORE the spec file is
 * imported, so `AppModule` / `PrismaService` always connect to the isolated test
 * database — never to the dev DB from backend/.env (`travelhub1`).
 *
 * The URL is guarded in e2e-db-config.ts: the database name must contain "test".
 */
import { resolveTestDatabaseUrl } from "./e2e-db-config";

const url = resolveTestDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.TEST_DATABASE_URL = url;
