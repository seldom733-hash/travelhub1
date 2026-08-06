import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { FULL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";
import { getOperationsData } from "@/lib/analytics/operations";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/operations
 * Оперативные панели BI Center (Гл. 2): Коммерческий радар (2.10.9),
 * Очередь заказов (2.11.11), Центр бронирований (2.12.12),
 * Центр финансов (2.13.12), Центр партнёров (2.15.12), Центр маркетинга (2.17.12).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const data = await getOperationsData();
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse(error, "Admin analytics operations API error");
  }
}
