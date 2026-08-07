import Link from "next/link";

const CENTERS = [
  { href: "/catalog", icon: "📚", title: "Catalog Center", desc: "Product / Tariff / Availability / Category", color: "from-blue-500 to-blue-600" },
  { href: "/customers", icon: "🤝", title: "CRM mini", desc: "Customer / Contact / Company / Partner / Supplier", color: "from-emerald-500 to-teal-600" },
  { href: "/orders", icon: "🧾", title: "Order Center", desc: "Order / OrderItem / OrderTraveler / Fulfillment", color: "from-violet-500 to-purple-600" },
  { href: "/bookings", icon: "📑", title: "Booking Center", desc: "Booking / Reservation / SupplierConfirmation / Passenger", color: "from-amber-500 to-orange-600" },
];

export default function OverviewPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-slate-900">TravelHub — Phase 1</h1>
      <p className="mt-1 text-sm text-slate-500">
        Сквозной процесс: <b>Product → Order → Booking</b>. Каждый домен — отдельная схема PostgreSQL, интеграция — только через события (transactional outbox).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CENTERS.map((c) => (
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
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
        <div className="mb-2 font-bold text-slate-900">Архитектурные принципы (Baseline, Phase 1)</div>
        <ul className="list-inside list-disc space-y-1 text-slate-500">
          <li>Канонические ID: PRD-*, ORD-*, BKG-*, CUS-* (неизменяемы, генерирует домен-владелец)</li>
          <li>Отдельная схема БД на домен: events, catalog, crm, order, booking — без FK между схемами</li>
          <li>Домен не пишет в чужие таблицы — только события (BookingRequested, BookingConfirmed…) + чтение</li>
          <li>Transactional outbox: событие атомарно с изменением сущности, доставка после коммита</li>
          <li>Audit by default: *_history таблицы во всех доменах</li>
        </ul>
      </div>
    </div>
  );
}
