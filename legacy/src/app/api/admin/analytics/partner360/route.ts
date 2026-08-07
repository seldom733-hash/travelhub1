import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { FULL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";
import { getPartner360Data } from "@/lib/analytics/partner360";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/partner360?partnerId=...
 * Partner 360° (Гл. 2.15.13): полный профиль партнёра.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const partnerId = new URL(request.url).searchParams.get("partnerId");
    if (!partnerId) {
      return NextResponse.json({ error: "Не указан partnerId" }, { status: 400 });
    }
    const data = await getPartner360Data(partnerId);
    if (!data) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse(error, "Admin analytics partner360 API error");
  }
}
