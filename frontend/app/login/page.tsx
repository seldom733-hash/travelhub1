"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, auth, fetchSessionUser } from "@/lib/api";
import { postLoginTarget, safeNextPath } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";
import LocaleSelector from "@/components/public/LocaleSelector";

/**
 * Login entry point. Phone-first identity (legacy username remains accepted),
 * role-aware redirect via safe ?next=.
 */
function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const rawNext = params.get("next");
  const next = safeNextPath(rawNext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSessionUser()
      .then((u) => {
        if (u) router.replace(postLoginTarget(u.role, rawNext));
      })
      .catch(() => undefined);
  }, [router, rawNext]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; user: { role: string } }>("/auth/login", {
        username,
        password,
      });
      auth.setToken(res.accessToken);
      router.replace(postLoginTarget(res.user.role, rawNext));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-dark-surface lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero1.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-dark/90 via-dark/55 to-dark/20" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gold text-base font-bold text-dark">N</span>
              <span className="font-display text-lg font-semibold text-white">Navitravel</span>
            </Link>
            <div className="max-w-md">
              <p className="font-display text-4xl font-semibold leading-[1.08] text-white">
                {t("auth.login_subtitle", locale)}
              </p>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-neutral-300">
                {t("footer.brand_description", locale)}
              </p>
            </div>
            <span className="text-xs text-neutral-400">© {new Date().getFullYear()} Navitravel</span>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gold text-base font-bold text-dark">N</span>
                <span className="font-display text-base font-semibold">Navitravel</span>
              </Link>
              <LocaleSelector />
            </div>

            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold leading-tight text-white">
                {t("auth.login_submit", locale)}
              </h1>
              <p className="mt-2 text-sm text-neutral-400">{t("auth.phone_login_hint", locale)}</p>
              <div className="mt-4 hidden lg:block">
                <LocaleSelector />
              </div>
            </div>

            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-300">
                  {t("auth.phone_login_label", locale)}
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  className="w-full rounded-xl border border-dark-border bg-dark-surface px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-gold"
                  placeholder="+994 50 000 00 00"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-300">
                  {t("auth.password_label", locale)}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-dark-border bg-dark-surface px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-gold"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !username || !password}
                className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-dark transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("auth.login_busy", locale) : t("auth.login_submit", locale)}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-neutral-400">
              <Link href="/" className="transition-colors hover:text-white">
                {t("auth.back_marketplace", locale)}
              </Link>
              <span className="mx-2 text-neutral-600">·</span>
              {t("auth.no_account", locale)}{" "}
              <Link
                href={`/register${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="font-semibold text-gold hover:text-gold-light"
              >
                {t("auth.register_link", locale)}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-dark text-neutral-400">…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
