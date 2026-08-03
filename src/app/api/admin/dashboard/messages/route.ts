import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { getDashboardMessages } from "@/lib/dashboard-messages";

export const dynamic = "force-dynamic";

/**
 * Лёгкий эндпоинт для фонового обновления счётчика «N новых» в виджете
 * «Сообщения» (Гл. 1.24): дашборд опрашивает его раз в минуту и тихо
 * обновляет только блок messages — без перезагрузки всей страницы.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await getDashboardMessages());
  } catch (error) {
    return serverErrorResponse(error, "Dashboard messages API error");
  }
}
