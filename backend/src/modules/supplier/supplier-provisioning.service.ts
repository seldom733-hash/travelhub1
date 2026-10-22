import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { FlightSupplierRegistry } from "./flight-supplier.registry";
import { SUPPLIER_TOKEN_CRM_NAMES } from "./supplier-crm-names";
import { CrmService } from "../crm/crm.service";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Авто-provisioning CRM-партнёров для зарегистрированных адаптеров (§Наценки
 * / §Курсы поставщиков).
 *
 * Проблема: раньше партнёры создавались ТОЛЬКО ручным сидом
 * (partners-canonical-seed) — новый адаптер поставщика появлялся в поиске,
 * но его не было в таблице «Партнёры», а значит и в «Курсах поставщиков»
 * (список = ACTIVE Partners ∪ строки SupplierFxRate) и в «Наценках» не было
 * строки с настроенными партнёрскими курсами.
 *
 * Решение: после регистрации адаптеров (onModuleInit выполняется ПОСЛЕ
 * instantiation всех провайдеров, включая фабрику SUPPLIER_MODULE_INIT) для
 * каждого УНИКАЛЬНОГО кода адаптера (tours/hotels одного провайдера = один
 * партнёр) ищем в crm.Partner партнёра по каноническому имени из
 * SUPPLIER_TOKEN_CRM_NAMES (case-insensitive); при отсутствии —
 * CrmService.createPartner(name), который в ОДНОЙ транзакции выделяет код
 * PRN-* и сеет дефолтные FX-курсы (1 USD = 1.7 AZN, 1 EUR = 1.91 AZN) с
 * провенансом в SupplierFxRateHistory.
 *
 * Идемпотентность и безопасность:
 *  • существующий партнёр (любого статуса, включая INACTIVE FSTravel) НЕ
 *    трогается — статус решает только админ;
 *  • ошибки БД не роняют старт приложения (warn + продолжаем работу);
 *  • «Наценки» (matrix) строятся из реестра адаптеров — поставщик появляется
 *    там автоматически; ячейки без MarkupRule = NOT_CONFIGURED (0%), и это
 *    честно: ставку наценки задаёт админ, а не система.
 */
@Injectable()
export class SupplierProvisioningService implements OnModuleInit {
  private readonly logger = new Logger(SupplierProvisioningService.name);

  constructor(
    private readonly registry: SupplierAdapterRegistry,
    private readonly flightRegistry: FlightSupplierRegistry,
    private readonly crm: CrmService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureCrmPartners();
    } catch (err) {
      // Старт приложения не должен зависеть от CRM-БД: адаптеры работают и
      // без партнёров (только «Курсы поставщиков»/«Наценки» будут неполны).
      this.logger.warn(`Supplier provisioning failed (non-fatal): ${(err as Error).message}`);
    }
  }

  /** Уникальные коды зарегистрированных адаптеров (tours + hotels + flights). */
  private collectSupplierCodes(): string[] {
    const codes = new Set<string>();
    for (const { adapter } of this.registry.getEntries()) {
      codes.add(adapter.code);
    }
    for (const code of this.flightRegistry.list()) {
      codes.add(code);
    }
    return [...codes];
  }

  private async ensureCrmPartners(): Promise<void> {
    for (const code of this.collectSupplierCodes()) {
      const name = SUPPLIER_TOKEN_CRM_NAMES[code] ?? code;

      const existing = await this.prisma.partner.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true, code: true, name: true, status: true },
      });
      if (existing) {
        this.logger.debug(
          `Supplier provisioning: ${code} → partner ${existing.code} "${existing.name}" [${existing.status}] exists — skipped`,
        );
        continue;
      }

      const partner = await this.crm.createPartner(name);
      this.logger.log(
        `Supplier provisioning: created CRM partner ${partner.code} "${partner.name}" for adapter ${code} ` +
          `(default FX rates seeded)`,
      );
    }
  }
}
