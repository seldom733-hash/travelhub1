export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cities?type=TOUR&countries=TR,GE
 * Возвращает количество услуг по городам (по countryCode + city из БД).
 * Опционально: type — тип услуги, countries — список кодов стран через запятую.
 */
export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const countriesParam = searchParams.get("countries");

    const where: Record<string, unknown> = { isActive: true };
    if (type) where.type = type;
    if (countriesParam) {
      const codes = countriesParam.split(",").map((c) => c.trim()).filter(Boolean);
      if (codes.length) where.countryCode = { in: codes };
    }

    const result = await prisma.service.groupBy({
      by: ["countryCode", "city"],
      where,
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
    });

    const cities = result
      .filter((r) => r.countryCode && r.city && r.city.trim() !== "")
      .map((r) => ({
        countryCode: r.countryCode,
        name: r.city,
        count: r._count.city,
      }));

    return NextResponse.json({ cities });
  } catch (error) {
    console.error("Cities fetch error:", error);
    return NextResponse.json({ cities: [] });
  }
}
