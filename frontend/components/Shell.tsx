"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, auth, type AuthUser } from "@/lib/api";

const NAV = [
  { href: "/", icon: "🏠", label: "Обзор" },
  { href: "/catalog", icon: "📚", label: "Catalog Center" },
  { href: "/orders", icon: "🧾", label: "Order Center" },
  { href: "/bookings", icon: "📑", label: "Booking Center" },
  { href: "/customers", icon: "🤝", label: "CRM mini" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || pathname === "/login") return;
    if (!auth.token) {
      router.replace("/login");
      return;
    }
    api
      .get<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => {
        auth.clear();
        router.replace("/login");
      });
  }, [mounted, pathname, router]);

  // До монтирования рендерим одинаковый заглушечный DOM (SSR = client, без hydration mismatch).
  if (!mounted) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Загрузка…</div>;
  }

  // Логин-страница рендерится без сайдбара.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!auth.token) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Загрузка…</div>;
  }

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined);
    auth.clear();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="thin-scroll sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto bg-slate-900 text-slate-200">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500 text-base font-bold text-white">T</div>
          <div>
            <div className="text-base font-bold text-white">
              Travel<span className="text-blue-400">Hub</span>
            </div>
            <div className="text-[10px] text-slate-400">Phase 2 · Auth + RBAC</div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-r-2 border-blue-400 bg-blue-500/15 font-medium text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="w-5 text-center text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          {user && (
            <div className="mb-3">
              <div className="truncate text-sm font-medium text-white">{user.fullName ?? user.username}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                {user.role}
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="thin-scroll flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
