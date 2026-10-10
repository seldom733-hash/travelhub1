import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Tenant-scoped Reference Number Service (Phase 3 Pre-Step 3.12).
 *
 * Generates human-readable, tenant-aware reference numbers for business objects.
 * Patterns:
 *   Marketplace:  MKT-{TYPE}-{SEQ}
 *   Storefront:   {SF_CODE}-{TYPE}-{SEQ}
 *   SaaS:         SAAS-{SF_CODE}-{TYPE}-{SEQ}
 *
 * Concurrency safety / СПЛОШНАЯ последовательность (Owner Decision, аудит
 * нумераций): Hi/Lo-блочная аллокация УДАЛЕНА. Каждая аллокация = ровно один
 * атомарный upsert `value += 1` на строке BusinessSequence (ключ REFSEQ:{key}),
 * исполняемый на клиенте, переданном вызывающим: доменная tx → инкремент в её
 * рамках (rollback возвращает номер), без tx (legacy `null`-вызовы) →
 * autocommit на глобальном клиенте. Хвосты блоков не сжигаются, кэша/claim-
 * гейтов/in-memory состояния нет — перезапуск процесса последовательность
 * не ломает. См. подробности компромисса в ids.service.ts.
 *
 * Reference numbers are:
 *   - immutable after creation
 *   - tenant-scoped (never leaked across tenants)
 *   - human-readable (UI, search, support, exports)
 *   - NOT a replacement for internal UUID in authorization
 */
@Injectable()
export class ReferenceNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a reference number for a business object.
   *
   * @param tx       - Transaction client домена (аллокация в его рамках); null → глобальный клиент.
   * @param prefix   - Namespace prefix: "MKT", "SAAS", or storefront code (e.g. "SF001")
   * @param typeCode - Object type: "ORD", "BKG", "PAY", "REF", "INV", "REQ"
   * @param digits   - Sequence digits (default 8: 00000001..99999999)
   */
  async nextReferenceNumber(
    tx: Prisma.TransactionClient | null,
    prefix: string,
    typeCode: string,
    digits = 8,
  ): Promise<string> {
    const seqKey = `REF:${prefix}:${typeCode}`;
    const value = await this.allocate(tx, seqKey);
    return `${prefix}-${typeCode}-${String(value).padStart(digits, "0")}`;
  }

  /**
   * Marketplace reference: MKT-{TYPE}-{SEQ}
   */
  async nextMarketplaceReference(
    tx: Prisma.TransactionClient | null,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, "MKT", typeCode);
  }

  /**
   * Storefront commerce reference: {SF_CODE}-{TYPE}-{SEQ}
   */
  async nextStorefrontReference(
    tx: Prisma.TransactionClient | null,
    storefrontCode: string,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, storefrontCode, typeCode);
  }

  /**
   * SaaS reference: SAAS-{SF_CODE}-{TYPE}-{SEQ}
   */
  async nextSaasReference(
    tx: Prisma.TransactionClient | null,
    storefrontCode: string,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, `SAAS-${storefrontCode}`, typeCode);
  }

  // ── Shared Commerce Sequence (8 digits) ──────────────────────────────

  /**
   * Allocate a new 8-digit shared commerceSequence root.
   * Used to create entity references: MKT-REQ-*, MKT-ORD-*, MKT-BKG-*, MKT-PAY-*
   * All entities in one commerce chain share the same root number.
   */
  async nextCommerceSequence(
    tx: Prisma.TransactionClient | null,
  ): Promise<string> {
    const value = await this.allocate(tx, "REFSEQ:COMMERCE:ROOT");
    return String(value).padStart(8, "0");
  }

  /**
   * Marketplace Request reference: MKT-REQ-{root}
   */
  commerceRequestRef(commerceSequence: string): string {
    return `MKT-REQ-${commerceSequence}`;
  }

  /**
   * Marketplace Order reference: MKT-ORD-{root}
   */
  commerceOrderRef(commerceSequence: string): string {
    return `MKT-ORD-${commerceSequence}`;
  }

  /**
   * Marketplace Booking reference: MKT-BKG-{root}
   */
  commerceBookingRef(commerceSequence: string): string {
    return `MKT-BKG-${commerceSequence}`;
  }

  /**
   * Marketplace Payment reference: MKT-PAY-{root}-{ordinal}
   */
  commercePaymentRef(commerceSequence: string, ordinal: number): string {
    return `MKT-PAY-${commerceSequence}-${ordinal}`;
  }

  // ── Backward-compatible independent references (for non-commerce-chain objects)

  /**
   * Independent Marketplace reference (legacy / non-chain).
   * For objects that don't belong to a shared commerce chain.
   */
  async nextIndependentMarketplaceReference(
    tx: Prisma.TransactionClient | null,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, "MKT", typeCode);
  }

  /** Атомарный increment +1 по строке REFSEQ:{key}. Прямой, без кэша/блоков:
   *  один вызов = ровно один следующий номер (сплошная последовательность). */
  private async allocate(tx: Prisma.TransactionClient | null, key: string): Promise<number> {
    const client = (tx && typeof (tx as { businessSequence?: unknown }).businessSequence !== "undefined"
      ? tx
      : this.prisma) as unknown as Prisma.TransactionClient;
    const prefix = `REFSEQ:${key}`;
    const record = await client.businessSequence.upsert({
      where: { prefix },
      update: { value: { increment: 1 } },
      create: { prefix, value: 1 },
    });
    return record.value;
  }
}
