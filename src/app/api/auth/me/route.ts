import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { WORKSPACE_KEYS } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — текущий пользователь сессии или null. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

/**
 * PATCH /api/auth/me { defaultWorkspace } — меняет стартовое рабочее
 * пространство Dashboard пользователя (Гл. 1.2, 1.44). Ключ проверяется
 * по списку известных пространств.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { defaultWorkspace } = await request.json().catch(() => ({}));
    if (typeof defaultWorkspace !== "string" || !(WORKSPACE_KEYS as readonly string[]).includes(defaultWorkspace)) {
      return NextResponse.json(
        { error: "Неизвестное рабочее пространство" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { defaultWorkspace },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyName: true,
        defaultWorkspace: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Me PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
