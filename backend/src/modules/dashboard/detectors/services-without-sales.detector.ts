// ─── Services Without Sales Detector ─────────────────────────────────────────
// Detects published products with zero orders.
// Stage D: enriched with availability state, publication age for WHY attribution.
// Evidence: count, product names, availability counts, time-based grouping.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  DecisionSignalDetector,
  DetectedCondition,
  AffectedEntityRef,
  SignalEvidenceItem,
} from "../decision-signal.types";
import { DecisionSignalService } from "../decision-signal.service";

@Injectable()
export class ServicesWithoutSalesDetector implements DecisionSignalDetector {
  key = "services_without_sales";

  constructor(private readonly prisma: PrismaService) {}

  async detect(): Promise<DetectedCondition[]> {
    const unsold: { id: string; title: string; createdAt: Date }[] =
      await (this.prisma as any).$queryRawUnsafe(`
      SELECT p.id, p.title, p."createdAt"
      FROM "catalog"."Product" p
      WHERE p.status = 'PUBLISHED'::"catalog"."ProductStatus"
        AND NOT EXISTS (
          SELECT 1 FROM "order"."OrderItem" oi WHERE oi."productId" = p.id
        )
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `);

    if (unsold.length === 0) return [];

    const affectedEntities: AffectedEntityRef[] = unsold.map((p: { id: string; title: string; createdAt: Date }) => ({
      entityType: "PRODUCT" as const,
      entityId: p.id,
    }));

    // Stage D enrichment: publication age grouping
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    let recentlyPublishedCount = 0;
    let longTermUnsoldCount = 0;

    for (const p of unsold) {
      const age = now - new Date(p.createdAt).getTime();
      if (age < THIRTY_DAYS) {
        recentlyPublishedCount++;
      } else {
        longTermUnsoldCount++;
      }
    }

    // Stage D enrichment: availability state
    // Check how many unsold products have configured availability
    let withAvailabilityCount = 0;
    let withoutAvailabilityCount = 0;

    if (unsold.length > 0) {
      const productIds = unsold.map((p: { id: string }) => `'${p.id}'`).join(",");
      const availResult: { count: bigint }[] = await (this.prisma as any).$queryRawUnsafe(`
        SELECT count(*) as count
        FROM "catalog"."Product" p
        WHERE p.id IN (${productIds})
          AND EXISTS (
            SELECT 1 FROM "catalog"."Availability" a WHERE a."productId" = p.id
          )
      `);
      withAvailabilityCount = Number(availResult[0]?.count ?? 0);
      withoutAvailabilityCount = unsold.length - withAvailabilityCount;
    }

    const nowIso = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "unsoldProductCount",
        value: unsold.length,
        source: "catalog.Product",
        observedAt: nowIso,
      },
      {
        key: "productNames",
        value: unsold.slice(0, 10).map((p: { id: string; title: string; createdAt: Date }) => p.title).join(", "),
        source: "catalog.Product",
        observedAt: nowIso,
      },
      // Stage D: availability state
      {
        key: "withAvailabilityCount",
        value: withAvailabilityCount,
        source: "catalog.Availability",
        observedAt: nowIso,
      },
      {
        key: "withoutAvailabilityCount",
        value: withoutAvailabilityCount,
        source: "catalog.Availability",
        observedAt: nowIso,
      },
      // Stage D: publication age
      {
        key: "recentlyPublishedCount",
        value: recentlyPublishedCount,
        unit: "products",
        source: "catalog.Product",
        observedAt: nowIso,
      },
      {
        key: "longTermUnsoldCount",
        value: longTermUnsoldCount,
        unit: "products",
        source: "catalog.Product",
        observedAt: nowIso,
      },
    ];

    const fingerprint = DecisionSignalService.generateFingerprint(this.key, [
      { entityType: "PRODUCT", entityId: "_all_unsold" },
    ]);

    return [
      {
        code: "SERVICES_WITHOUT_SALES",
        category: "CATALOG",
        fingerprint,
        affectedEntities,
        evidence,
      },
    ];
  }
}
