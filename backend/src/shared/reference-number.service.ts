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
   * @param digits   - Sequence digits (default 6: 000001..999999)
   */
  async nextReferenceNumber(
    _tx: Prisma.TransactionClient,
    prefix: string,
    typeCode: string,
    digits = 6,
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
