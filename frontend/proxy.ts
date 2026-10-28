import { NextResponse, type NextRequest } from "next/server";

/**
 * PHASE 1 STEP 1.6+1.8 — Server-side auth boundary для защищённых контуров.
 *
 * /app/* (internal employee Work Centers) и /partner/* (Partner Cabinet, Step 1.8)
 * требуют authenticated user (§10): недостаточно скрыть sidebar. Proxy-слой
 * блокирует anonymous access на сервере: без cookie `travelhub.auth` → редирект
 * на /login?next=<path> (глубокие ссылки переживают refresh).
 *
 * Step 2.17 (auth hardening): cookie `travelhub.auth` — серверная HttpOnly
 * сессия (ставится при login/register, снимается при logout), JS её не читает.
 * Здесь проверяется только НАЛИЧИЕ cookie (первый барьер, не security):
 * валидность/revocation/роль проверяет backend на каждом API-запросе, а
 * клиентский useCurrentUser через /auth/session уводит невалидную сессию на
 * /login. Ролевая принадлежность (PARTNER vs internal) проверяется клиентски
 * в PartnerLayout/Shell; backend остаётся авторитетным.
 *
 * Next.js 16: file convention `middleware.ts` deprecated → `proxy.ts` (тот же
 * API: NextRequest/NextResponse/cookies/matcher, named export `proxy`).
 */
const AUTH_COOKIE = "travelhub.auth";
const LOGIN_URL = "/login";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const isLocalHost = !host || host === "localhost" || host === "127.0.0.1" || host === "::1";

  // Custom Storefront domains: resolve verified host → /store/<slug>.
  // Drafts never become public here because the backend only returns
  // ACTIVE+entitled slugs for VERIFIED custom domains.
  if (!isLocalHost && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
    try {
      const backend = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:4000/api/v1";
      const res = await fetch(`${backend}/public/domains/resolve?host=${encodeURIComponent(host)}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { slug?: string | null };
        if (data.slug) {
          const url = req.nextUrl.clone();
          url.pathname = `/store/${data.slug}${pathname === "/" ? "" : pathname}`;
          return NextResponse.rewrite(url);
        }
      }
    } catch {
      /* network failure: fall through to normal host behavior */
    }
  }

  const requiresAuth = pathname === "/app" || pathname.startsWith("/app/") || pathname === "/partner" || pathname.startsWith("/partner/") || pathname === "/account" || pathname.startsWith("/account/") || pathname === "/preview" || pathname.startsWith("/preview/");
  const authed = req.cookies.get(AUTH_COOKIE)?.value;
  if (requiresAuth && !authed) {
    const login = req.nextUrl.clone();
    login.pathname = LOGIN_URL;
    login.search = "";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Catch custom-domain hostnames too; auth is scoped to /app, /partner and
  // /account inside proxy().
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
