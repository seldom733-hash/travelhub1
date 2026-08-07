import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { FULL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";
import { parseAnalyticsFilters } from "@/lib/analytics";
import { isAnalyticsSection, buildAnalyticsSection } from "@/lib/analytics/index";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/[section]
 * Возвращает унифицированные данные раздела BI Center (Гл. 2).
 * Секции: overview | sales | orders | bookings | finance | crm | partners | catalog | marketing.
 * Параметры: period, from, to, country, city, type, partnerId, manager, status, currency.
 */
export async function GET(request: Request, { params }: { params: Promise<{ section: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const { section } = await params;
    if (!isAnalyticsSection(section)) {
      return NextResponse.json({ error: `Неизвестный раздел аналитики: ${section}` }, { status: 400 });
    }

    const filters = parseAnalyticsFilters(new URL(request.url).searchParams);
    const data = await buildAnalyticsSection(section, filters);
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse(error, "Admin analytics section API error");
  }
}
