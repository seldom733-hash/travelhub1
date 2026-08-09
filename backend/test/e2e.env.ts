/**
 * Jest `setupFiles` entry: runs in every e2e spec worker BEFORE the spec file is
 * imported, so `AppModule` / `PrismaService` always connect to the isolated test
 * database — never to the dev DB from backend/.env (`travelhub1`).
 *
 * The URL is guarded in e2e-db-config.ts: the database name must contain "test".
 */
import { resolveTestDatabaseUrl } from "./e2e-db-config";
import { MINIO_TEST_ACCESS_KEY, MINIO_TEST_BUCKET, MINIO_TEST_PORT, MINIO_TEST_SECRET_KEY } from "./e2e.minio";

const url = resolveTestDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.TEST_DATABASE_URL = url;

// Step 1.2: media-тесты работают против ИЗОЛИРОВАННОГО standalone MinIO
// (test/e2e.minio.ts) с отдельным test bucket — dev/prod bucket не затрагивается.
process.env.S3_ENDPOINT = `http://127.0.0.1:${MINIO_TEST_PORT}`;
process.env.S3_BUCKET = MINIO_TEST_BUCKET;
process.env.S3_REGION = "us-east-1";
process.env.S3_ACCESS_KEY = MINIO_TEST_ACCESS_KEY;
process.env.S3_SECRET_KEY = MINIO_TEST_SECRET_KEY;
process.env.S3_FORCE_PATH_STYLE = "true";
