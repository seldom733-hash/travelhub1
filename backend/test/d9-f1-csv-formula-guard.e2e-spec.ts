/**
 * D9-F1 — CSV Formula Injection: representative live-endpoint proof.
 *
 * Prompt §11/§13: prove shared-serializer mitigation through a real export
 * endpoint carrying user-controlled text. Surface: Catalog products export
 * (GET /api/v1/products/export) — product titles are partner/staff-controlled
 * text reaching a staff download (the exact D9-F1 attack path).
 *
 * Proven here:
 *   1. attacker-controlled title ("=…" formula payload) is serialized as a
 *      protected text cell ("'=…") in raw bytes and in RFC-4180 parse;
 *   2. normal titles stay verbatim; column order/count unchanged; BOM kept;
 *   3. auth gates unchanged (401 anonymous; PARTNER denied on a staff-only
 *      export — permission parity, D9 §8).
 *
 * Test DB: isolated per-suite template DB (jest-e2e) — business tables start
 * empty, so export rows are exactly the fixture products created here.
 */
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

/** Minimal RFC-4180 parser (BOM-tolerant) for readback proof. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

describe("D9-F1 — products export formula-injection runtime proof", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent> | null = null;

  const stamp = Date.now();
  const evildoerTitle = '=HYPERLINK("http://evil")';
  const partnerUsername = `d9f1_b_${stamp}`;
  const partnerPassword = "D9F1Password!2026";
  const created = {
    productIds: [] as string[],
    partnerUserId: null as string | null,
    partnerId: null as string | null,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "admin", password: "admin123" })
      .expect(200);
    const token = (login.body as { accessToken: string }).accessToken;
    adminAgent = request.agent(app.getHttpServer());
    adminAgent.set("Authorization", `Bearer ${token}`);
  });

  afterAll(async () => {
    if (created.productIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
    }
    if (created.partnerUserId) {
      await prisma.user.deleteMany({ where: { id: created.partnerUserId } });
    }
    if (created.partnerId) {
      await prisma.partner.deleteMany({ where: { id: created.partnerId } });
    }
    await app.close();
  });

  it("1. anonymous products export → 401 (auth gate unchanged)", async () => {
    await request(app.getHttpServer()).get("/api/v1/products/export").expect(401);
  });

  it("2. PARTNER on staff-only Orders export → 403 (permission parity unchanged)", async () => {
    // Canonical test-fixture route: existing PARTNER role via admin API only,
    // bound to a test-only CRM Partner (commercial Product creation requires
    // a Partner owner — domain invariant).
    const partner = await prisma.partner.create({
      data: { code: `PAR-D9F1-${stamp}`, name: "D9F1 Fixture Partner" },
    });
    created.partnerId = partner.id;
    const createRes = await adminAgent
      .post("/api/v1/users")
      .send({
        username: partnerUsername,
        password: partnerPassword,
        roleCode: "PARTNER",
        partnerId: partner.id,
      })
      .expect(201);
    const body = createRes.body as { id?: string; user?: { id?: string } };
    created.partnerUserId = body.id ?? body.user?.id ?? null;
    expect(created.partnerUserId).toBeTruthy();

    const partnerLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: partnerUsername, password: partnerPassword })
      .expect(200);
    const partnerToken = (partnerLogin.body as { accessToken: string }).accessToken;
    partnerAgent = request.agent(app.getHttpServer());
    partnerAgent.set("Authorization", `Bearer ${partnerToken}`);

    await partnerAgent.get("/api/v1/orders/export").expect(403);
  });

  it("3. attacker-controlled title is protected in raw bytes and parsed CSV; normal data verbatim", async () => {
    // Canonical D9-F1 attack path: PARTNER-controlled text (own product title)
    // later downloaded by staff through the shared export serializer.
    const evilRes = await partnerAgent!
      .post("/api/v1/products")
      .send({ type: "TOUR", title: evildoerTitle, slug: `d9f1-evil-${stamp}` })
      .expect(201);
    const evilBody = evilRes.body as { id?: string; product?: { id: string } };
    created.productIds.push((evilBody.product ?? evilBody).id!);

    const normalRes = await partnerAgent!
      .post("/api/v1/products")
      .send({ type: "TOUR", title: "Hotel Antalya", slug: `d9f1-normal-${stamp}` })
      .expect(201);
    const normalBody = normalRes.body as { id?: string; product?: { id: string } };
    created.productIds.push((normalBody.product ?? normalBody).id!);

    const res = await adminAgent.get("/api/v1/products/export").expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");

    const raw = res.text;
    expect(raw.charCodeAt(0)).toBe(0xfeff); // BOM behavior preserved
    // Protected representation in raw bytes: apostrophe guard + RFC-4180
    // quoting/quote-doubling (payload contains '"'), i.e. the cell must be
    // emitted as "'=HYPERLINK(""http://evil"")" — never as a raw formula.
    const quotedProtected = `"'${evildoerTitle.replace(/"/g, '""')}"`;
    expect(raw).toContain(quotedProtected);
    expect(raw).toContain("Hotel Antalya"); // normal text verbatim

    const parsed = parseCsv(raw);
    const header = parsed[0];
    expect(header).toEqual([
      "ID",
      "Code",
      "Title",
      "Type",
      "Status",
      "Category",
      "Tariffs",
      "PriceFrom",
      "PublishedAt",
      "CreatedAt",
    ]);

    // Isolated suite DB → exactly the two fixture products.
    expect(parsed).toHaveLength(3);
    const evilRow = parsed.find(r => r[2] === `'${evildoerTitle}`);
    const normalRow = parsed.find(r => r[2] === "Hotel Antalya");
    expect(evilRow).toBeDefined();
    expect(normalRow).toBeDefined();
    expect(evilRow!).toHaveLength(header.length); // column count/order unchanged
    expect(normalRow!).toHaveLength(header.length);
    expect(evilRow![1]).toMatch(/^PRD-/); // canonical business code intact
    expect(normalRow![1]).toMatch(/^PRD-/);
  });
});
