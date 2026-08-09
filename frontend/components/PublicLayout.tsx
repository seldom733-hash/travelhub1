"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, type AuthUser } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { isInternalRole, isPublicPath } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";
import { fireMarketplaceSearch } from "@/lib/behavioral-events";
import { publicApi, type PublicCategory } from "@/lib/public-api";
import LocaleSelector from "./public/LocaleSelector";

/**
 * PHASE 1 STEP 1.7 §4 — Public Header (витринный chrome).
 * - TravelHub brand → /;
 * - категории (из public Category API — не хардкод);
 * - универсальный поиск → /search?q=;
 * - locale selector RU/AZ/EN (§17);
 * - account state: login / workspace (internal roles) / logout (external);
 * - НИКАКИХ internal sidebar/действий.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const locale = useLocale();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader user={user} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-400">
        {t("footer.text", locale)} © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function PublicHeader({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [catOpen, setCatOpen] = useState(false);

  // Категории — из public API (не хардкод как единственный источник истины).
  useEffect(() => {
    let alive = true;
    void publicApi
      .listCategories()
      .then((c) => {
        if (alive) setCategories(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    // Step 1.13B: committed search из шапки (публичная Marketplace surface) —
    // durable behavioral event (тот же контракт, что home/search page search).
    fireMarketplaceSearch(query);
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  const logout = () => {
    void auth.clear();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {/* Logo → public root */}
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="TravelHub">
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-base font-bold text-white">
            T
          </div>
          <span className="hidden text-base font-bold text-slate-900 sm:block">
            Travel<span className="text-blue-600">Hub</span>
          </span>
        </Link>

        {/* Public nav — только public-safe routes */}
        <nav className="hidden items-center gap-1 text-sm text-slate-600 md:flex" aria-label="Main">
          <Link
            href="/search"
            className="rounded-lg px-3 py-1.5 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {t("nav.services", locale)}
          </Link>

          {/* Categories dropdown (public API) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((o) => !o)}
              aria-expanded={catOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {t("nav.categories", locale)}
              <span aria-hidden className="text-[10px]">
                {catOpen ? "▲" : "▼"}
              </span>
            </button>
            {catOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1 grid max-h-96 w-72 grid-cols-1 gap-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:grid-cols-2"
              >
                <Link
                  href="/search"
                  role="menuitem"
                  onClick={() => setCatOpen(false)}
                  className="col-span-full rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  {t("home.categories_all", locale)} →
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    role="menuitem"
                    onClick={() => setCatOpen(false)}
                    className="truncate rounded-lg px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    {c.title}
                  </Link>
                ))}
                {categories.length === 0 && (
                  <div className="col-span-full px-3 py-2 text-xs text-slate-400">{t("state.loading", locale)}</div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Universal search entry */}
        <form onSubmit={submitSearch} role="search" className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
          <label className="sr-only" htmlFor="header-search">
            {t("nav.search_placeholder", locale)}
          </label>
          <input
            id="header-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("nav.search_placeholder", locale)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t("nav.find", locale)}
          </button>
        </form>

        {/* Locale selector (§17) */}
        <LocaleSelector />

        {/* Step 1.10: public Partner onboarding entry */}
        <Link
          href="/become-a-partner"
          className="hidden shrink-0 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 lg:block"
        >
          {t("nav.become_partner", locale)}
        </Link>

        {/* Account / Work Area entry (Step 1.9 §8 account states) */}
        <div className="shrink-0">
          {user === null ? (
            <div className="flex items-center gap-2 text-sm">
              <Link
                href={isPublicPath(pathname) && pathname !== "/" ? `/register?next=${encodeURIComponent(pathname)}` : "/register"}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                {t("nav.register", locale)}
              </Link>
              <Link
                href="/login"
                className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t("nav.login", locale)}
              </Link>
            </div>
          ) : isInternalRole(user.role) ? (
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/account"
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                {t("nav.account", locale)}
              </Link>
              <Link
                href="/app/dashboard"
                className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white transition-colors hover:bg-slate-700"
              >
                {t("nav.workspace", locale)}
              </Link>
            </div>
          ) : user.role === "PARTNER" ? (
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/account"
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                {t("nav.account", locale)}
              </Link>
              <Link
                href="/partner"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-emerald-700"
              >
                {t("nav.cabinet", locale)}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/account"
                className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t("nav.account", locale)}
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
              >
                {t("nav.logout", locale)}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
