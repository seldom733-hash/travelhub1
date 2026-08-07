import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { FULL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";
import { getCustomer360Data } from "@/lib/analytics/customer360";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/customer360?userId=...
 * Customer 360° (Гл. 2.14.13): полный профиль клиента.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Не указан userId" }, { status: 400 });
    }
    const data = await getCustomer360Data(userId);
    if (!data) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse(error, "Admin analytics customer360 API error");
  }
}
