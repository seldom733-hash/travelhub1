"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-user";

const CENTERS = [
  {
    href: "/catalog",
    icon: "📚",
    title: "Catalog Center",
    desc: "Product / Tariff / Availability / Category",
    color: "from-blue-500 to-blue-600",
    permission: "catalog.product.read",
  },
  {
    href: "/customers",
    icon: "🤝",
    title: "CRM mini",
    desc: "Customer / Contact / Company / Partner / Supplier",
    color: "from-emerald-500 to-teal-600",
    permission: "crm.customer.read",
  },
  {
    href: "/orders",
    icon: "🧾",
    title: "Order Center",
    desc: "Order / OrderItem / OrderTraveler / Fulfillment",
    color: "from-violet-500 to-purple-600",
    permission: "order.read",
  },
  {
    href: "/bookings",
    icon: "📑",
    title: "Booking Center",
    desc: "Booking / Reservation / SupplierConfirmation / Passenger",
    color: "from-amber-500 to-orange-600",
    permission: "booking.read",
  },
];

export default function OverviewPage() {
  const user = useCurrentUser();
  const visible = user ? CENTERS.filter((c) => user.permissions.includes(c.permission)) : CENTERS;
  const hiddenCount = CENTERS.length - visible.length;

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-slate-900">TravelHub</h1>
      <p className="mt-1 text-sm text-slate-500">
        Сквозной процесс: <b>Product → Order → Booking</b>. Каждый домен — отдельная схема PostgreSQL, интеграция — только через события (transactional outbox).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {visible.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl text-white ${c.color}`}>
              {c.icon}
            </div>
            <div className="mt-3 text-base font-bold text-slate-900 group-hover:text-blue-600">{c.title}</div>
            <div className="mt-1 text-xs text-slate-500">{c.desc}</div>
          </Link>
        ))}
        {hiddenCount > 0 && (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-400">
            {hiddenCount} раздел(ов) скрыто — нет прав доступа
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
        <div className="mb-2 font-bold text-slate-900">Архитектурные принципы (Baseline)</div>
        <ul className="list-inside list-disc space-y-1 text-slate-500">
          <li>Канонические ID: PRD-*, ORD-*, BKG-*, CUS-* (неизменяемы, генерирует домен-владелец)</li>
          <li>Отдельная схема БД на домен: events, catalog, crm, order, booking, security — без FK между схемами</li>
          <li>Домен не пишет в чужие таблицы — только события (BookingRequested, BookingConfirmed…) + чтение</li>
          <li>Transactional outbox: событие атомарно с изменением сущности, доставка после коммита</li>
          <li>RBAC (Phase 2): JWT + 10 канонических ролей, granular permissions, аудит безопасности</li>
          <li>Audit by default: *_history таблицы во всех доменах</li>
        </ul>
      </div>
    </div>
  );
}
