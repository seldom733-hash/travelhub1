import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/register { firstName, lastName, email, password, role?, companyName?, phone?, partnerType? } */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateLimit = checkRateLimit(`register:${ip}`, 3, 60000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Слишком много попыток. Попробуйте через минуту." }, { status: 429 });
    }

    const { firstName, lastName, email, password, role, companyName, phone, partnerType } =
      await request.json().catch(() => ({}));

    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanFirst = typeof firstName === "string" ? firstName.trim() : "";

    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
    }
    if (!cleanFirst) {
      return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Пароль должен быть не короче 8 символов" }, { status: 400 });
    }

    const userRole = role === "PARTNER" ? "PARTNER" : "BUYER";

    const exists = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (exists) {
      return NextResponse.json({ error: "Пользователь с таким email уже зарегистрирован" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash: `hash:${password}`,
        firstName: cleanFirst,
        lastName: typeof lastName === "string" && lastName.trim() ? lastName.trim() : null,
        role: userRole as "BUYER" | "PARTNER",
        companyName: userRole === "PARTNER" && typeof companyName === "string" && companyName.trim() ? companyName.trim() : null,
        phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        partnerType: typeof partnerType === "string" && partnerType.trim() ? partnerType.trim() : null,
      },
    });

    await setSessionCookie(user.id);
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyName: user.companyName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
