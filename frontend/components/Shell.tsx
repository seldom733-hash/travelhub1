"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", icon: "🏠", label: "Обзор" },
  { href: "/catalog", icon: "📚", label: "Catalog Center" },
  { href: "/orders", icon: "🧾", label: "Order Center" },
  { href: "/bookings", icon: "📑", label: "Booking Center" },
  { href: "/customers", icon: "🤝", label: "CRM mini" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
            <div className="text-[10px] text-slate-400">Phase 1 · v0.1</div>
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
        <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
          Модульный монолит: 4 домена, 5 схем PostgreSQL, transactional outbox.
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="thin-scroll flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
