import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — завершить сессию. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  await clearSessionCookie();
  // Гл. 3.18 «Пользовательские действия»: выход из системы.
  if (user) {
    const ctx = requestContext(request);
    await recordAudit({
      user,
      category: "Безопасность",
      action: "logout",
      objectType: "Пользователь",
      objectId: user.id,
      objectNumber: user.email,
      comment: "Выход из системы",
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return NextResponse.json({ ok: true });
}
