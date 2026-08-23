// ─── Pending Bookings Detector ───────────────────────────────────────────────
// Representative detector for Stage B Decision Signal foundation.
// Detects bookings pending confirmation beyond a configurable SLA threshold.
// This proves the full detector → signal → evidence → lifecycle flow.

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
export class PendingBookingsDetector implements DecisionSignalDetector {
  key = "pending_booking_confirmation_sla";

  /** Default SLA: 4 hours (240 minutes). */
  private readonly slaMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    slaMinutes?: number,
  ) {
    this.slaMinutes = slaMinutes ?? 240;
  }

  async detect(): Promise<DetectedCondition[]> {
    const slaThreshold = new Date(Date.now() - this.slaMinutes * 60 * 1000);

    // Find bookings awaiting confirmation that exceed SLA
    const overdueBookings = await (this.prisma as any).booking.findMany({
      where: {
        status: "AWAITING_CONFIRMATION",
        createdAt: { lt: slaThreshold },
      },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        currency: true,
      },
      orderBy: { createdAt: "asc" },
      take: 500, // Bound result set
    });

    if (overdueBookings.length === 0) {
      return [];
    }

    // Calculate evidence metrics
    const oldestBooking = overdueBookings[0];
    const oldestMinutes = Math.round(
      (Date.now() - new Date(oldestBooking.createdAt).getTime()) / 60000,
    );

    // Sum of affected GMV
    const affectedGmv = overdueBookings.reduce(
      (sum: number, b: any) => sum + Number(b.amount ?? 0),
      0,
    );

    const currency = oldestBooking.currency ?? "AZN";

    // Affected entity references
    const affectedEntities: AffectedEntityRef[] = overdueBookings.slice(0, 50).map((b: any) => ({
      entityType: "BOOKING" as const,
      entityId: b.id,
    }));

    // Structured evidence
    const now = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "pendingConfirmationCount",
        value: overdueBookings.length,
        source: "booking.BOOKING",
        observedAt: now,
      },
      {
        key: "oldestPendingMinutes",
        value: oldestMinutes,
        unit: "minutes",
        source: "booking.BOOKING",
        observedAt: now,
        entityRef: { entityType: "BOOKING", entityId: oldestBooking.id },
      },
      {
        key: "affectedGmv",
        value: affectedGmv,
        unit: currency,
        source: "booking.BOOKING",
        observedAt: now,
      },
      {
        key: "slaThresholdMinutes",
        value: this.slaMinutes,
        unit: "minutes",
        source: "config",
        observedAt: now,
      },
    ];

    // Global fingerprint — one signal for all pending bookings (operational)
    const fingerprint = DecisionSignalService.generateFingerprint(this.key, [
      { entityType: "BOOKING", entityId: "_all_pending" },
    ]);

    return [
      {
        code: "BOOKING_CONFIRMATION_DELAY",
        category: "OPERATIONAL",
        fingerprint,
        affectedEntities,
        evidence,
      },
    ];
  }
}
