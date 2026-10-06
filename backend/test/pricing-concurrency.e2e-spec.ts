/**
 * SUPPLIER MARKUP PHASE 6 §6.9/§6.11 (e2e) — concurrency hardening.
 *
 * T1 — §6.9 concurrent MarkupRule activation: два DRAFT с пересекающимся
 *      effective-окном активируются параллельно → ровно один 201, второй 409
 *      (pg_advisory_xact_lock сериализует, overlap-инвариант fail-closed);
 *      среди пары активна ровно одна rule. Никаких race-created duplicate ACTIVE.
 * T2 — §6.11 concurrent pricing resolver: N параллельных resolve одного key →
 *      идентичные результаты (один и тот же ACTIVE rule/rate/version), без
 *      different markup / missing rule / conflicting rule.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { MarkupRuleStatus } from "../src/generated/prisma/enums";

interface CreatedRule {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  rate: string;
  status: string;
  version: number;
}

interface Resolution {
  found: boolean;
  rate?: string;
  ruleCode?: string | null;
  ruleVersion?: number | null;
}

const stamp = Date.now();
const PAST = "2026-01-01T00:00:00.000Z";

describe("Supplier Markup Phase 6 §6.9/§6.11 — concurrency (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fin: ReturnType<typeof request.agent>;
  const created: { rules: string[] } = { rules: [] };

  const ruleBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    supplierCode: "ANEX",
    serviceType: "tours",
    rate: "0.04",
    effectiveFrom: PAST,
    ...overrides,
  });

  const createRule = async (body: Record<string, unknown>): Promise<CreatedRule> => {
    const res = await fin.post("/api/v1/pricing/markup-rules").send(body).expect(201);
    created.rules.push((res.body as CreatedRule).id);
    return res.body as CreatedRule;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    fin = request.agent(app.getHttpServer());
    fin.set("Authorization", `Bearer ${(res.body as { accessToken: string }).accessToken}`);
  });

  afterAll(async () => {
    if (created.rules.length > 0) {
      await prisma.markupRuleHistory.deleteMany({ where: { ruleId: { in: created.rules } } });
      await prisma.markupRule.deleteMany({ where: { id: { in: created.rules } } });
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: created.rules } } });
    }
    await app.close();
  });

  it("T1. concurrent activation of overlapping rules → exactly one 201, one 409, one ACTIVE", async () => {
    const a = await createRule(ruleBody({ rate: "0.04" }));
    const b = await createRule(ruleBody({ rate: "0.06" }));
    expect(a.code).not.toBe(b.code);

    const [r1, r2] = await Promise.all([
      fin.post(`/api/v1/pricing/markup-rules/${a.code}/activate`),
      fin.post(`/api/v1/pricing/markup-rules/${b.code}/activate`),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const loser = r1.status === 409 ? r1 : r2;
    expect(String((loser.body as { message?: string }).message)).toContain("already covers");

    // среди пары — ровно одна ACTIVE (нет race-created duplicate)
    const winners = await prisma.markupRule.findMany({
      where: { id: { in: [a.id, b.id] }, status: MarkupRuleStatus.ACTIVE },
    });
    expect(winners).toHaveLength(1);

    // cleanup: winner уходит в ARCHIVED (не мешает другим сьютам)
    const winnerCode = winners[0].code;
    await fin.post(`/api/v1/pricing/markup-rules/${winnerCode}/archive`).expect(201);
  });

  it("T2. concurrent resolver: 10 parallel resolves → identical rule/rate/version", async () => {
    const rule = await createRule(ruleBody({ rate: "0.07" }));
    await fin.post(`/api/v1/pricing/markup-rules/${rule.code}/activate`).expect(201);

    const at = new Date().toISOString();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        fin
          .get("/api/v1/pricing/markup-rules/resolve")
          .query({ supplierCode: "ANEX", serviceType: "tours", at }),
      ),
    );
    for (const res of results) expect(res.status).toBe(200);

    const parsed = results.map((r) => r.body as Resolution);
    const first = parsed[0];
    expect(first.found).toBe(true);
    expect(first.ruleCode).toBe(rule.code);
    for (const p of parsed) expect(p).toEqual(first); // no different markup / missing rule

    await fin.post(`/api/v1/pricing/markup-rules/${rule.code}/archive`).expect(201);
  });
});
