import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** POST /api/auth/login { email, password } */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateLimit = checkRateLimit(`login:${ip}`, 5, 60000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Слишком много попыток. Попробуйте через минуту." }, { status: 429 });
    }

    const { email, password } = await request.json().catch(() => ({}));
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const ctx = requestContext(request);
    if (!user || !verifyPassword(user.passwordHash, password)) {
      // Гл. 3.18 «Безопасность»: неудачная попытка входа фиксируется в журнале аудита.
      await recordAudit({
        actorName: email.trim().toLowerCase(),
        category: "Безопасность",
        action: "login_failed",
        objectType: "Пользователь",
        objectNumber: email.trim().toLowerCase(),
        comment: "Неудачная попытка входа в систему",
        criticality: "warning",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: "Аккаунт деактивирован" }, { status: 403 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Гл. 3.18 «Пользовательские действия»: успешный вход.
    await recordAudit({
      user,
      category: "Безопасность",
      action: "login",
      objectType: "Пользователь",
      objectId: user.id,
      objectNumber: user.email,
      comment: "Вход в систему",
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    await setSessionCookie(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyName: user.companyName,
        defaultWorkspace: user.defaultWorkspace,
      },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
