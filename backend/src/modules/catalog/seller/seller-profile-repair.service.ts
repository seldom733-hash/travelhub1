/**
 * SellerProfileRepairService (Phase 1 Step 1.11 REVIEW FIX 1).
 *
 * Явная one-time idempotent migration/repair command для LEGACY Partners без
 * PublicSellerProfile. НЕ вызывается из runtime lifecycle (onModuleInit):
 * новые Partner получают профиль СОБЫТИЙНО (PartnerCreated → ensure ANONYMOUS),
 * поэтому startup reconciliation больше не нужен. Оператор (MODERATOR/ADMIN)
 * запускает ремонт явно: endpoint + CLI, с dry-run/report/audit.
 *
 * Контракт (сохраняет требования review):
 *  - dry-run: только чтения; отчёт без изменений БД;
 *  - idempotency: повторный прогон не создаёт дубликатов (unique partnerId);
 *  - default ANONYMOUS (консервативно; никогда raw CRM имя/поля);
 *  - не трогает существующие корректные/approved профили (только create-if-missing);
 *  - не публикует raw CRM Partner (в профиль пишутся только seller-safe поля +
 *    системный countryCode из crm.Partner);
 *  - skippedBrokenPartner: ACTIVE Partner без минимальной безопасной identity
 *    (нет name ИЛИ нет ни contactEmail, ни registrationNumber) — пропускается
 *    без создания (no guessing);
 *  - report: { scanned, created, alreadyPresent, skippedBrokenPartner, dryRun };
 *  - audit: каждая реально созданная запись аудируется + итоговый audit результата.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";
import { PublicSellerProfileService } from "./seller-profile.service";
import { isKnownCountryCode } from "./locations";

export interface SellerProfileRepairReport {
  scanned: number;
  created: number;
  alreadyPresent: number;
  skippedBrokenPartner: number;
  dryRun: boolean;
}

@Injectable()
export class SellerProfileRepairService {
  private readonly logger = new Logger(SellerProfileRepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerProfiles: PublicSellerProfileService,
    private readonly security: SecurityService,
  ) {}

  async run(dryRun = false): Promise<SellerProfileRepairReport> {
    const partners = await this.prisma.partner.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, contactEmail: true, registrationNumber: true, countryCode: true },
    });
    const existing = await this.prisma.publicSellerProfile.findMany({
      where: { partnerId: { in: partners.map((p) => p.id) } },
      select: { partnerId: true },
    });
    const have = new Set(existing.map((p) => p.partnerId));

    let created = 0;
    let alreadyPresent = 0;
    let skippedBrokenPartner = 0;

    for (const p of partners) {
      if (have.has(p.id)) {
        alreadyPresent += 1;
        continue;
      }
      // Без минимальной безопасной identity профиль не создаём (no guessing):
      // нужен name + хотя бы один канонический ключ (contactEmail | registrationNumber).
      const broken = !p.name?.trim() || (!p.contactEmail && !p.registrationNumber);
      if (broken) {
        skippedBrokenPartner += 1;
        continue;
      }
      created += 1;
      if (dryRun) continue;
      await this.prisma.$transaction(async (tx) => {
        const profileId = await this.sellerProfiles.ensureProfileForPartner(tx, p.id, isKnownCountryCode(p.countryCode) ? p.countryCode : null);
        await this.security.audit(tx, {
          userId: null,
          username: "seller-profile-repair",
          action: "seller_profile.repair_created",
          resource: "PublicSellerProfile",
          resourceId: profileId,
          details: { partnerId: p.id, visibilityMode: "ANONYMOUS", countryCode: p.countryCode ?? null },
        });
      });
    }

    if (!dryRun && partners.length > 0) {
      this.logger.log(
        `PublicSellerProfile repair: scanned=${partners.length} created=${created} alreadyPresent=${alreadyPresent} skippedBrokenPartner=${skippedBrokenPartner}`,
      );
    }
    return { scanned: partners.length, created, alreadyPresent, skippedBrokenPartner, dryRun };
  }

  /** Итоговый audit результата ремонта (вызывается контроллером/CLI). */
  async auditResult(
    actor: { id: string; username: string } | null,
    report: SellerProfileRepairReport,
  ): Promise<void> {
    await this.security.audit(undefined, {
      userId: actor?.id ?? null,
      username: actor?.username ?? "seller-profile-repair",
      action: report.dryRun ? "seller_profile.repair_dryrun" : "seller_profile.repair",
      resource: "PublicSellerProfile",
      resourceId: null,
      details: { ...report },
    });
  }
}
