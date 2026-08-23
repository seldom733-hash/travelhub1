// ─── Upcoming Bookings Detector ──────────────────────────────────────────────
// Detects confirmed/new bookings with future service dates.
// Evidence: count, total GMV, nearest service date.

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
export class UpcomingBookingsDetector implements DecisionSignalDetector {
  key = "upcoming_bookings";

  constructor(private readonly prisma: PrismaService) {}

  async detect(): Promise<DetectedCondition[]> {
    const upcoming = await (this.prisma as any).booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "NEW"] },
        serviceDate: { gt: new Date() },
      },
      select: {
        id: true,
        serviceDate: true,
        amount: true,
        currency: true,
      },
      orderBy: { serviceDate: "asc" },
      take: 200,
    });

    if (upcoming.length === 0) return [];

    const nearest = upcoming[0];
    const daysUntilNearest = Math.round(
      (new Date(nearest.serviceDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    const totalGmv = upcoming.reduce(
      (sum: number, b: any) => sum + Number(b.amount ?? 0),
      0,
    );

    const currency = nearest.currency ?? "AZN";

    const affectedEntities: AffectedEntityRef[] = upcoming.slice(0, 50).map((b: any) => ({
      entityType: "BOOKING" as const,
      entityId: b.id,
    }));

    const now = new Date().toISOString();
    const evidence: SignalEvidenceItem[] = [
      {
        key: "upcomingCount",
        value: upcoming.length,
        source: "booking.BOOKING",
        observedAt: now,
      },
      {
        key: "daysUntilNearest",
        value: daysUntilNearest,
        unit: "days",
        source: "booking.BOOKING",
        observedAt: now,
        entityRef: { entityType: "BOOKING", entityId: nearest.id },
      },
      {
        key: "totalUpcomingGmv",
        value: totalGmv,
        unit: currency,
        source: "booking.BOOKING",
        observedAt: now,
      },
    ];

    const fingerprint = DecisionSignalService.generateFingerprint(this.key, [
      { entityType: "BOOKING", entityId: "_all_upcoming" },
    ]);

    return [
      {
        code: "UPCOMING_BOOKINGS",
        category: "OPERATIONAL",
        fingerprint,
        affectedEntities,
        evidence,
      },
    ];
  }
}
