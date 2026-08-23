// ─── Services Without Sales Detector ─────────────────────────────────────────
// Detects published products with zero orders.
// Evidence: count, product names/ids.

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
    const unsold: { id: string; title: string }[] = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT p.id, p.title
      FROM "catalog"."Product" p
      WHERE p.status = 'PUBLISHED'::"catalog"."ProductStatus"
        AND NOT EXISTS (
          SELECT 1 FROM "order"."OrderItem" oi WHERE oi."productId" = p.id
        )
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `);

    if (unsold.length === 0) return [];

    const affectedEntities: AffectedEntityRef[] = unsold.map((p: { id: string; title: string }) => ({
      entityType: "PRODUCT" as const,
      entityId: p.id,
    }));

    const now = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "unsoldProductCount",
        value: unsold.length,
        source: "catalog.Product",
        observedAt: now,
      },
      {
        key: "productNames",
        value: unsold.slice(0, 10).map((p: { id: string; title: string }) => p.title).join(", "),
        source: "catalog.Product",
        observedAt: now,
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
