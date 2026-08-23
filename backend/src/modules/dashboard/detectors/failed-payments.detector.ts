// ─── Failed Payments Detector ────────────────────────────────────────────────
// Detects payments with FAILED status that need attention.
// Evidence: count, oldest failed payment, affected amounts.

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
export class FailedPaymentsDetector implements DecisionSignalDetector {
  key = "failed_payments";

  constructor(private readonly prisma: PrismaService) {}

  async detect(): Promise<DetectedCondition[]> {
    const failedPayments = await (this.prisma as any).payment.findMany({
      where: { status: "FAILED" },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        currency: true,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    if (failedPayments.length === 0) return [];

    const oldest = failedPayments[0];
    const oldestMinutes = Math.round(
      (Date.now() - new Date(oldest.createdAt).getTime()) / 60000,
    );

    const totalAmount = failedPayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount ?? 0),
      0,
    );

    const currency = oldest.currency ?? "AZN";

    const affectedEntities: AffectedEntityRef[] = failedPayments.slice(0, 50).map((p: any) => ({
      entityType: "PAYMENT" as const,
      entityId: p.id,
    }));

    const now = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "failedCount",
        value: failedPayments.length,
        source: "finance.PAYMENT",
        observedAt: now,
      },
      {
        key: "oldestFailedMinutes",
        value: oldestMinutes,
        unit: "minutes",
        source: "finance.PAYMENT",
        observedAt: now,
        entityRef: { entityType: "PAYMENT", entityId: oldest.id },
      },
      {
        key: "totalFailedAmount",
        value: totalAmount,
        unit: currency,
        source: "finance.PAYMENT",
        observedAt: now,
      },
    ];

    const fingerprint = DecisionSignalService.generateFingerprint(this.key, [
      { entityType: "PAYMENT", entityId: "_all_failed" },
    ]);

    return [
      {
        code: "FAILED_PAYMENTS",
        category: "FINANCIAL",
        fingerprint,
        affectedEntities,
        evidence,
      },
    ];
  }
}
