import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/services?type=TOUR&limit=6&sort=popular|price_asc|price_desc|rating&featured=1&hot=1 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as string | null;
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const sort = searchParams.get("sort") || "popular";
    const featured = searchParams.get("featured") === "1";
    const hot = searchParams.get("hot") === "1";

    const where = {
      isActive: true,
      ...(type ? { type: type as never } : {}),
      ...(featured ? { isFeatured: true } : {}),
      ...(hot ? { isHot: true } : {}),
    };

    const orderBy =
      sort === "price_asc"
        ? { price: "asc" as const }
        : sort === "price_desc"
          ? { price: "desc" as const }
          : sort === "rating"
            ? { rating: "desc" as const }
            : { reviewCount: "desc" as const };

    const services = await prisma.service.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        slug: true,
        shortDesc: true,
        price: true,
        discountPrice: true,
        currency: true,
        city: true,
        country: true,
        countryCode: true,
        rating: true,
        reviewCount: true,
        images: true,
        duration: true,
        maxGuests: true,
        isFeatured: true,
        isHot: true,
        hotDiscount: true,
      },
    });

    const count = await prisma.service.count({ where });
    return NextResponse.json({ services, count });
  } catch (error) {
    console.error("Services API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
