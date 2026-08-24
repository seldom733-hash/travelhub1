// ─── Recent Cancellations Detector ───────────────────────────────────────────
// Detects orders cancelled in the last 7 days.
// Evidence: count, oldest cancellation, affected GMV.

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
export class RecentCancellationsDetector implements DecisionSignalDetector {
  key = "recent_cancellations";

  constructor(private readonly prisma: PrismaService) {}

  async detect(): Promise<DetectedCondition[]> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const nowTs = new Date(Date.now());
    const cancelled = await (this.prisma as any).order.findMany({
      where: {
        status: "CANCELLED",
        createdAt: { gt: cutoff, lte: nowTs },
      },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        currency: true,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    if (cancelled.length === 0) return [];

    const oldest = cancelled[0];
    const oldestMinutes = Math.round(
      (Date.now() - new Date(oldest.createdAt).getTime()) / 60000,
    );

    const totalGmv = cancelled.reduce(
      (sum: number, o: any) => sum + Number(o.amount ?? 0),
      0,
    );

    const currency = oldest.currency ?? "AZN";

    const affectedEntities: AffectedEntityRef[] = cancelled.slice(0, 50).map((o: any) => ({
      entityType: "ORDER" as const,
      entityId: o.id,
    }));

    const now = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "cancellationCount",
        value: cancelled.length,
        source: "order.ORDER",
        observedAt: now,
      },
      {
        key: "oldestCancellationMinutes",
        value: oldestMinutes,
        unit: "minutes",
        source: "order.ORDER",
        observedAt: now,
        entityRef: { entityType: "ORDER", entityId: oldest.id },
      },
      {
        key: "affectedGmv",
        value: totalGmv,
        unit: currency,
        source: "order.ORDER",
        observedAt: now,
      },
      {
        key: "periodDays",
        value: 7,
        unit: "days",
        source: "config",
        observedAt: now,
      },
    ];

    const fingerprint = DecisionSignalService.generateFingerprint(this.key, [
      { entityType: "ORDER", entityId: "_recent_cancelled" },
    ]);

    return [
      {
        code: "RECENT_CANCELLATIONS",
        category: "OPERATIONAL",
        fingerprint,
        affectedEntities,
        evidence,
      },
    ];
  }
}
