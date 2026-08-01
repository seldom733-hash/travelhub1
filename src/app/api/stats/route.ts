import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/stats — счётчики для футера и главной. */
export async function GET() {
  try {
    const [typeCounts, users, partners] = await Promise.all([
      prisma.service.groupBy({
        by: ["type"],
        _count: { id: true },
        where: { isActive: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "PARTNER" } }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of typeCounts) counts[row.type] = row._count.id;

    return NextResponse.json({
      services: {
        tours: counts["TOUR"] ?? 0,
        hotels: counts["HOTEL"] ?? 0,
        sanatoriums: counts["SANATORIUM"] ?? 0,
        excursions: counts["EXCURSION"] ?? 0,
        flights: counts["FLIGHT"] ?? 0,
        trains: counts["TRAIN"] ?? 0,
        guides: counts["GUIDE"] ?? 0,
        photographers: counts["PHOTOGRAPHER"] ?? 0,
        transfers: counts["TRANSFER"] ?? 0,
      },
      users,
      partners,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
