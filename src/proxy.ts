import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-token";

/**
 * Proxy (в Next.js 16 middleware переименован в proxy).
 * Защищает приватные маршруты: без валидной сессии → редирект на /login?redirect=...
 *
 * Верификация только по подписи cookie (без обращения к БД) — быстро и работает
 * на CDN. Роль не проверяется здесь: для /admin и т.п. роль проверяется в layout
 * через getCurrentUser(). Добавляйте новые приватные префиксы в matcher ниже.
 */

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token && verifySessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Matcher-значения должны быть константами для статического анализа.
  matcher: [
    "/profile/:path*",
    "/account/:path*",
    "/bookings/:path*",
    "/orders/:path*",
    "/favorites/:path*",
  ],
};
