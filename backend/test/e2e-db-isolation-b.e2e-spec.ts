/**
 * Round 6 — DB Isolation Contract Suite B
 *
 * Proves per-suite PostgreSQL database isolation:
 * - current_database() matches E2E_SUITE_DB_NAME (different from Suite A)
 * - current_database() is NOT the shared base travelhub1_test
 * - Sentinel table is isolated: no Suite A data present
 *
 * This is a real Nest/Prisma E2E test against an isolated suite DB.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Round 6 — DB Isolation Contract Suite B", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("current_database() matches E2E_SUITE_DB_NAME", async () => {
    const rows = await prisma.$queryRawUnsafe<{ current_database: string }[]>(
      "SELECT current_database()",
    );
    const dbName = rows[0].current_database;
    const expectedName = process.env.E2E_SUITE_DB_NAME;

    expect(expectedName).toBeDefined();
    expect(dbName).toBe(expectedName);
    expect(dbName).not.toBe("travelhub1_test");
    expect(dbName).toMatch(/^travelhub1_/);
    expect(dbName).toMatch(/_test$/);
    console.log(`[isolation-b] current_database = ${dbName}, expected = ${expectedName}`);
  });

  it("E2E_SUITE_TEST_PATH_HASH is populated", () => {
    expect(process.env.E2E_SUITE_TEST_PATH_HASH).toBeDefined();
    expect(process.env.E2E_SUITE_TEST_PATH_HASH!.length).toBeGreaterThan(0);
  });

  it("creates sentinel table and inserts Suite B marker", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.e2e_isolation_sentinel (
        key text PRIMARY KEY,
        value text NOT NULL
      )
    `);

    // Verify no Suite A sentinel exists (Suite A ran in different DB)
    const aRows = await prisma.$queryRawUnsafe<{ key: string }[]>(
      "SELECT key FROM public.e2e_isolation_sentinel WHERE key = $1",
      "round6-suite-a",
    );
    expect(aRows).toHaveLength(0);

    // Insert Suite B sentinel
    await prisma.$executeRawUnsafe(
      "INSERT INTO public.e2e_isolation_sentinel (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      "round6-suite-b",
      "sentinel-value-b",
    );

    // Verify only Suite B sentinel exists
    const allRows = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
      "SELECT key, value FROM public.e2e_isolation_sentinel ORDER BY key",
    );
    expect(allRows).toHaveLength(1);
    expect(allRows[0].key).toBe("round6-suite-b");
    expect(allRows[0].value).toBe("sentinel-value-b");
  });
});
