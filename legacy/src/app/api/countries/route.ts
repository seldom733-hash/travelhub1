export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { countriesDatabase, getCountryName } from "@/lib/countries-data";

export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const locale = searchParams.get("locale") || "ru";

    // Build a lookup map: countryCode -> localized name
    const codeToName: Record<string, string> = {};
    countriesDatabase.forEach(c => {
      codeToName[c.code] = getCountryName(c, locale);
    });

    // Return all countries from DB
    const where: Record<string, unknown> = { isActive: true };
    if (type) where.type = type;

    const result = await prisma.service.groupBy({
      by: ["countryCode"],
      where,
      _count: { countryCode: true },
      orderBy: { _count: { countryCode: "desc" } },
    });

    const countries = result
      .filter((r) => r.countryCode && r.countryCode.trim() !== "")
      .map((r) => ({
        code: r.countryCode,
        name: codeToName[r.countryCode!] || r.countryCode,
        count: r._count.countryCode,
        available: true,
      }))
      .filter(c => !search || (c.name ?? "").toLowerCase().includes(search.toLowerCase()));

    return NextResponse.json({ countries });
  } catch (error) {
    console.error("Countries fetch error:", error);
    return NextResponse.json({ countries: [] });
  }
}
