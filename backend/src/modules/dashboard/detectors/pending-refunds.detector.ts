// ─── Pending Refunds Detector ────────────────────────────────────────────────
// Detects refunds with REQUESTED status that need approval/processing.
// Evidence: count, oldest pending refund, total amount.

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
export class PendingRefundsDetector implements DecisionSignalDetector {
  key = "pending_refunds";

  constructor(private readonly prisma: PrismaService) {}

  async detect(): Promise<DetectedCondition[]> {
    const pending = await (this.prisma as any).refund.findMany({
      where: { status: "REQUESTED" },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        currency: true,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    if (pending.length === 0) return [];

    const oldest = pending[0];
    const oldestMinutes = Math.round(
      (Date.now() - new Date(oldest.createdAt).getTime()) / 60000,
    );

    const totalAmount = pending.reduce(
      (sum: number, r: any) => sum + Number(r.amount ?? 0),
      0,
    );

    const currency = oldest.currency ?? "AZN";

    const affectedEntities: AffectedEntityRef[] = pending.slice(0, 50).map((r: any) => ({
      entityType: "PAYMENT" as const,
      entityId: r.id,
    }));

    const now = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "pendingRefundCount",
        value: pending.length,
        source: "finance.REFUND",
        observedAt: now,
      },
      {
        key: "oldestPendingMinutes",
        value: oldestMinutes,
        unit: "minutes",
        source: "finance.REFUND",
        observedAt: now,
        entityRef: { entityType: "PAYMENT", entityId: oldest.id },
      },
      {
        key: "totalRefundAmount",
        value: totalAmount,
        unit: currency,
        source: "finance.REFUND",
        observedAt: now,
      },
    ];

    const fingerprint = DecisionSignalService.generateFingerprint(this.key, [
      { entityType: "PAYMENT", entityId: "_all_pending_refunds" },
    ]);

    return [
      {
        code: "PENDING_REFUNDS",
        category: "FINANCIAL",
        fingerprint,
        affectedEntities,
        evidence,
      },
    ];
  }
}
