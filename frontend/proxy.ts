import { NextResponse, type NextRequest } from "next/server";

/**
 * PHASE 1 STEP 1.6+1.8 — Server-side auth boundary для защищённых контуров.
 *
 * /app/* (internal employee Work Centers) и /partner/* (Partner Cabinet, Step 1.8)
 * требуют authenticated user (§10): недостаточно скрыть sidebar. Proxy-слой
 * блокирует anonymous access на сервере: без cookie `travelhub.auth` → редирект
 * на /login?next=<path> (глубокие ссылки переживают refresh).
 *
 * Cookie зеркалит token из localStorage (lib/api.ts): ставится при login,
 * снимается при logout/401. Ролевая принадлежность (PARTNER vs internal)
 * проверяется клиентски в PartnerLayout/Shell; backend остаётся авторитетным.
 * Эта граница — первый барьер, не единственный.
 *
 * Next.js 16: file convention `middleware.ts` deprecated → `proxy.ts` (тот же
 * API: NextRequest/NextResponse/cookies/matcher, named export `proxy`).
 */
const AUTH_COOKIE = "travelhub.auth";
const LOGIN_URL = "/login";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = req.cookies.get(AUTH_COOKIE)?.value;

  if (!authed) {
    const login = req.nextUrl.clone();
    login.pathname = LOGIN_URL;
    login.search = "";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Step 1.9: /account/* — защищённый внешний контур (BUYER identity):
  // anonymous → /login?next=/account...
  matcher: ["/app", "/app/:path*", "/partner", "/partner/:path*", "/account", "/account/:path*"],
};
