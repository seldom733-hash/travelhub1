"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-user";
import { useLocale } from "@/lib/i18n";

const SECTIONS = [
  {
    href: "/app/geography",
    icon: "🗺",
    ru: "География",
    az: "Coğrafiya",
    en: "Geography",
    ruDesc: "Страны, города, курорты и аэропорты",
    azDesc: "Ölkələr, şəhərlər, kurortlar və aeroportlar",
    enDesc: "Countries, cities, resorts and airports",
    permission: "geography.read",
  },
  {
    href: "/app/hotel-directory",
    icon: "🏨",
    ru: "Отели",
    az: "Otellər",
    en: "Hotels",
    ruDesc: "Категории, типы номеров, питания, размещения и виды из номера",
    azDesc: "Kateqoriyalar, otaq, qidalanma, yerləşmə və mənzərə növləri",
    enDesc: "Categories, room, meal, placement and view types",
    permission: "hotel_directory.read",
  },
  {
    href: "/app/references/service-types",
    icon: "🧾",
    ru: "Типы услуг",
    az: "Xidmət növləri",
    en: "Service types",
    ruDesc: "Справочник типов услуг платформы",
    azDesc: "Platformanın xidmət növləri lüğəti",
    enDesc: "Platform service type dictionary",
    permission: "hotel_directory.read",
  },
  {
    href: "/app/references/airlines",
    icon: "✈️",
    ru: "Авиаклассы и багаж",
    az: "Aviabiletlər",
    en: "Airline classes and baggage",
    ruDesc: "Классы авиабилетов и нормы багажа",
    azDesc: "Aviabilet sinifləri və baqaj normaları",
    enDesc: "Airline classes and baggage allowances",
    permission: "hotel_directory.read",
  },
];

export default function ReferencesPage() {
  const locale = useLocale();
  const user = useCurrentUser();
  const visible = SECTIONS.filter((s) => !user || user.permissions.includes(s.permission));
  const label = (s: (typeof SECTIONS)[number], key: "title" | "desc") => {
    if (locale === "az") return key === "title" ? s.az : s.azDesc;
    if (locale === "en") return key === "title" ? s.en : s.enDesc;
    return key === "title" ? s.ru : s.ruDesc;
  };
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink">{locale === "az" ? "Lüğətlər" : locale === "en" ? "References" : "Справочники"}</h1>
      <p className="mt-1 text-sm text-ink/60">{locale === "az" ? "Platformanın vahid arayışları." : locale === "en" ? "Unified platform directories." : "Единые справочники платформы."}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <Link key={s.href} href={s.href} className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-xl text-white">{s.icon}</div>
            <div className="mt-3 text-base font-bold text-ink group-hover:text-brand">{label(s, "title")}</div>
            <div className="mt-1 text-xs text-ink/60">{label(s, "desc")}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
