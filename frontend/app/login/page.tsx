"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, auth, fetchSessionUser } from "@/lib/api";
import { postLoginTarget, safeNextPath } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";
import LocaleSelector from "@/components/public/LocaleSelector";

/**
 * Step 1.6 §12 + Step 1.9 §5-6 + Step 1.13 §16: вход ведёт по роли и safe ?next=:
 *  - internal-роли → /app/dashboard (или ?next= под /app/*);
 *  - PARTNER → /partner (или ?next= под /partner/*);
 *  - BUYER → ?next= public Marketplace-путь (/products/*, /search*, /categories/*)
 *    ИЛИ /account/* deep-link (Buyer Cabinet, Step 1.13); без next — /account
 *    (никогда /app/*, /partner/*).
 * ?next= валидируется safeNextPath (анти-open-redirect).
 * RU/AZ/EN (Step 1.9 §16): UI-ярлыки локализованы, locale сохраняется (localStorage).
 */
function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  // rawNext — исходный ?next= (null при отсутствии); next — санитизированный для
  // ссылок. postLoginTarget получает rawNext: отсутствие next → home роли (Step 1.13:
  // BUYER → /account), а не возврат на витрину «по умолчанию».
  const rawNext = params.get("next");
  const next = safeNextPath(rawNext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Уже залогиненный пользователь (Step 2.17: сессия в HttpOnly cookie):
  // проба /auth/session → переводим по роли (внешние — на витрину/next).
  useEffect(() => {
    fetchSessionUser()
      .then((u) => {
        if (u) router.replace(postLoginTarget(u.role, rawNext));
      })
      .catch(() => undefined);
  }, [router, next]);

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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-500 text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
            T
          </div>
          <h1 className="text-2xl font-bold text-white">
            Travel<span className="text-blue-400">Hub</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t("auth.login_subtitle", locale)}</p>
          <div className="mt-3 flex justify-center">
            <LocaleSelector />
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("auth.username_label", locale)}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            placeholder="admin"
          />

          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("auth.password_label", locale)}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            placeholder="••••••••"
          />

          {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("auth.login_busy", locale) : t("auth.login_submit", locale)}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="text-slate-400 hover:text-white">
            {t("auth.back_marketplace", locale)}
          </Link>
          <span className="mx-2">·</span>
          {t("auth.no_account", locale)}{" "}
          <Link href={`/register${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-blue-400 hover:text-blue-300">
            {t("auth.register_link", locale)}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
