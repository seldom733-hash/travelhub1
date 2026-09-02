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
 * Concurrency safety: uses Hi/Lo block allocation on BusinessSequence
 * (same mechanism as IdsService for code generation).
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

  private readonly blockSize = Number(
    process.env.REFERENCE_SEQUENCE_BLOCK_SIZE ?? 100,
  );
  private readonly cache = new Map<
    string,
    { next: number; end: number }
  >();
  private readonly claims = new Map<string, Promise<unknown>>();

  /**
   * Generate a reference number for a business object.
   *
   * @param tx       - Transaction client (for compatibility with callers)
   * @param prefix   - Namespace prefix: "MKT", "SAAS", or storefront code (e.g. "SF001")
   * @param typeCode - Object type: "ORD", "BKG", "PAY", "REF", "INV", "REQ"
   * @param digits   - Sequence digits (default 8: 00000001..99999999)
   */
  async nextReferenceNumber(
    _tx: Prisma.TransactionClient,
    prefix: string,
    typeCode: string,
    digits = 8,
  ): Promise<string> {
    const seqKey = `REF:${prefix}:${typeCode}`;
    const value = await this.allocate(seqKey);
    return `${prefix}-${typeCode}-${String(value).padStart(digits, "0")}`;
  }

  /**
   * Marketplace reference: MKT-{TYPE}-{SEQ}
   */
  async nextMarketplaceReference(
    tx: Prisma.TransactionClient,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, "MKT", typeCode);
  }

  /**
   * Storefront commerce reference: {SF_CODE}-{TYPE}-{SEQ}
   */
  async nextStorefrontReference(
    tx: Prisma.TransactionClient,
    storefrontCode: string,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, storefrontCode, typeCode);
  }

  /**
   * SaaS reference: SAAS-{SF_CODE}-{TYPE}-{SEQ}
   */
  async nextSaasReference(
    tx: Prisma.TransactionClient,
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
    _tx: Prisma.TransactionClient,
  ): Promise<string> {
    const value = await this.allocate("REFSEQ:COMMERCE:ROOT");
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
    tx: Prisma.TransactionClient,
    typeCode: string,
  ): Promise<string> {
    return this.nextReferenceNumber(tx, "MKT", typeCode);
  }

  /**
   * Hi/Lo block allocation for sequence numbers.
   * Same concurrency-safe mechanism as IdsService.
   */
  private allocate(key: string): Promise<number> {
    const block = this.cache.get(key);
    if (block && block.next <= block.end) {
      return Promise.resolve(block.next++);
    }

    const prior = this.claims.get(key) ?? Promise.resolve();
    const run = prior.then(async () => {
      const again = this.cache.get(key);
      if (again && again.next <= again.end) {
        return again.next++;
      }

      const prefix = `REFSEQ:${key}`;
      const claimed = await this.prisma.seqClient.$transaction((tx) =>
        tx.businessSequence.upsert({
          where: { prefix },
          update: { value: { increment: this.blockSize } },
          create: { prefix, value: this.blockSize },
        }),
      );

      const fresh = {
        next: claimed.value - this.blockSize + 1,
        end: claimed.value,
      };
      this.cache.set(key, fresh);
      return fresh.next++;
    });

    this.claims.set(key, run.catch(() => undefined));
    return run;
  }
}
