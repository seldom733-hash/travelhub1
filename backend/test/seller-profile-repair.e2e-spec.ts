/**
 * E2E PHASE 1 STEP 1.11 REVIEW FIX 1 — PublicSellerProfile legacy repair.
 *
 * Инварианты:
 *  - НЕТ runtime startup reconciliation: ACTIVE Partner без профиля, созданный
 *    напрямую (вне PartnerCreated), НЕ получает профиль автоматически;
 *  - repair — явная one-time команда (endpoint/CLI) с dry-run/report/audit;
 *  - dry-run: только чтения, отчёт без изменений БД;
 *  - реальный прогон создаёт консервативный ANONYMOUS профиль (create-if-missing);
 *  - повторный прогон идемпотентен (alreadyPresent, 0 новых);
 *  - существующие корректные/approved профили НЕ перезаписываются;
 *  - skippedBrokenPartner: ACTIVE Partner без name или без identity-ключей;
 *  - не публикует raw CRM Partner; в профиль пишется системный countryCode;
 *  - audit: запись на каждое создание + итоговый audit результата.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

interface RepairReport {
  scanned: number;
  created: number;
  alreadyPresent: number;
  skippedBrokenPartner: number;
  dryRun: boolean;
}

describe("Phase 1 Step 1.11 — SellerProfileRepair (explicit, no startup backfill) (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const partnerIds: string[] = [];

  const runRepair = async (dryRun: boolean): Promise<RepairReport> => {
    const res = await adminAgent.post("/api/v1/seller-profiles/repair").send({ dryRun }).expect(201);
    return res.body as RepairReport;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    adminAgent = request.agent(app.getHttpServer());
    adminAgent.set("Authorization", `Bearer ${(login.body as { accessToken: string }).accessToken}`);
  });

  afterAll(async () => {
    await prisma.publicSellerProfileProposal.deleteMany({ where: { profile: { partnerId: { in: partnerIds } } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await prisma.auditLog.deleteMany({ where: { action: { in: ["seller_profile.repair", "seller_profile.repair_dryrun", "seller_profile.repair_created"] } } });
    await app.close();
  });

  it("1. startup НЕ запускает legacy mass reconciliation (Partner без профиля не получает его сам)", async () => {
    // Прямой insert (вне PartnerCreated) — профиль не должен появиться ни сразу,
    // ни «фоново»: onModuleInit reconciliation убран из lifecycle.
    const healthy = await prisma.partner.create({
      data: { code: `PAR-REPAIR-${stamp}`, name: "Repair Healthy", contactEmail: `repair-${stamp}@test.local`, countryCode: "AZ", status: "ACTIVE" },
    });
    partnerIds.push(healthy.id);
    const broken = await prisma.partner.create({
      data: { code: `PAR-REPAIRB-${stamp}`, name: "Repair Broken", status: "ACTIVE" }, // без identity-ключей
    });
    partnerIds.push(broken.id);

    const profiles = await prisma.publicSellerProfile.findMany({ where: { partnerId: { in: partnerIds } } });
    expect(profiles).toHaveLength(0);
  });

  it("2. repair dry-run: только отчёт, БД не меняется (no-op)", async () => {
    const report = await runRepair(true);
    expect(report.dryRun).toBe(true);
    expect(report.scanned).toBe(2);
    expect(report.created).toBe(1); // план: healthy партнёр
    expect(report.alreadyPresent).toBe(0);
    expect(report.skippedBrokenPartner).toBe(1); // без identity-ключей

    const profiles = await prisma.publicSellerProfile.findMany({ where: { partnerId: { in: partnerIds } } });
    expect(profiles).toHaveLength(0); // dry-run ничего не пишет
  });

  it("3. repair реальный прогон создаёт консервативный ANONYMOUS профиль с системным countryCode", async () => {
    const report = await runRepair(false);
    expect(report.dryRun).toBe(false);
    expect(report.created).toBe(1);
    expect(report.skippedBrokenPartner).toBe(1);

    const profile = await prisma.publicSellerProfile.findFirst({ where: { partnerId: partnerIds[0] } });
    expect(profile).not.toBeNull();
    expect(profile!.visibilityMode).toBe("ANONYMOUS");
    expect(profile!.status).toBe("APPROVED");
    expect(profile!.publicDisplayName).toBeNull();
    expect(profile!.countryCode).toBe("AZ"); // системная identity, не raw CRM поля
    expect(profile!.publicId).toMatch(/^SELL-\d{8}$/);
  });

  it("4. повторный repair идемпотентен: 0 новых, alreadyPresent=1", async () => {
    const report = await runRepair(false);
    expect(report.created).toBe(0);
    expect(report.alreadyPresent).toBe(1);
    expect(report.skippedBrokenPartner).toBe(1);

    const count = await prisma.publicSellerProfile.count({ where: { partnerId: partnerIds[0] } });
    expect(count).toBe(1);
  });

  it("5. repair НЕ перезаписывает approved PUBLIC_BRAND профиль", async () => {
    const profile = await prisma.publicSellerProfile.findFirstOrThrow({ where: { partnerId: partnerIds[0] } });
    await prisma.publicSellerProfile.update({
      where: { id: profile.id },
      data: { visibilityMode: "PUBLIC_BRAND", publicDisplayName: "Approved Brand", cityCode: "BAKU", version: { increment: 1 } },
    });

    const report = await runRepair(false);
    expect(report.created).toBe(0);
    expect(report.alreadyPresent).toBe(1);

    const after = await prisma.publicSellerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after.visibilityMode).toBe("PUBLIC_BRAND");
    expect(after.publicDisplayName).toBe("Approved Brand");
    expect(after.cityCode).toBe("BAKU");
  });

  it("6. broken partner (нет name) пропускается без создания", async () => {
    const noName = await prisma.partner.create({
      data: { code: `PAR-REPAIRC-${stamp}`, name: "", status: "ACTIVE" },
    });
    partnerIds.push(noName.id);

    const report = await runRepair(false);
    expect(report.scanned).toBe(3);
    expect(report.skippedBrokenPartner).toBe(2);
    const profile = await prisma.publicSellerProfile.findFirst({ where: { partnerId: noName.id } });
    expect(profile).toBeNull();
  });

  it("7. repair аудируется: запись на создание + итоговый результат", async () => {
    const createdAudits = await prisma.auditLog.findMany({ where: { action: "seller_profile.repair_created" } });
    expect(createdAudits.length).toBeGreaterThanOrEqual(1);
    expect(createdAudits[0].username).toBe("seller-profile-repair");

    const summary = await prisma.auditLog.findMany({ where: { action: "seller_profile.repair" } });
    expect(summary.length).toBeGreaterThanOrEqual(1);
    expect((summary[summary.length - 1].details as { scanned: number }).scanned).toBeGreaterThanOrEqual(3);

    const dryRunAudits = await prisma.auditLog.findMany({ where: { action: "seller_profile.repair_dryrun" } });
    expect(dryRunAudits.length).toBeGreaterThanOrEqual(1);
  });
});
