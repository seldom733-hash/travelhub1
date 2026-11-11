"use client";

import type { SupplierPriceCalendarEntryOffer } from "@/lib/supplier-api";

const MEAL_LABELS: Record<string, string> = {
  RO: "Без питания",
  BB: "Завтрак",
  HB: "Полупансион",
  FB: "Полный пансион",
  AI: "Всё включено",
  UAI: "Ультра всё включено",
};

const ROOM_LABELS: Array<[RegExp, string]> = [
  [/^SGL\b/i, "Одноместный"],
  [/^DBL\b/i, "Двухместный"],
  [/^TWIN\b/i, "Двухместный с двумя кроватями"],
  [/^TRPL\b/i, "Трёхместный"],
  [/^QUAD\b/i, "Четырёхместный"],
  [/^SUITE\b/i, "Люкс"],
  [/^FAMILY\b/i, "Семейный"],
  [/^DELUXE\b/i, "Делюкс"],
  [/^STANDARD\b|^STANDART\b/i, "Стандартный"],
  [/^ECONOMY\b|^ECO\b/i, "Эконом"],
];

function humanMeal(value?: string): string {
  const raw = (value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const code = raw.match(/^(RO|BB|HB|FB|AI|UAI)\b/i)?.[1]?.toUpperCase();
  return (code && MEAL_LABELS[code]) || raw;
}

function humanRoom(value?: string): string {
  const raw = (value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  for (const [re, label] of ROOM_LABELS) {
    if (re.test(raw)) {
      const suffix = raw.replace(re, "").replace(/^\s*[/,-]?\s*/, "").trim();
      return suffix ? `${label} · ${suffix}` : label;
    }
  }
  return raw;
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))];
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

function endDate(iso: string, nights: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  d.setUTCDate(d.getUTCDate() + Math.max(0, nights));
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function money(value: number | null | undefined, currency: string | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency ?? ""}`.trim();
}

export default function ServiceFacts({
  country,
  city,
  date,
  nights,
  adults,
  children,
  offers,
  price,
  currency,
}: {
  country?: string | null;
  city?: string | null;
  date?: string | null;
  nights: number;
  adults: number;
  children: number;
  offers: SupplierPriceCalendarEntryOffer[];
  price?: number | null;
  currency?: string | null;
}) {
  if (!date) return null;

  const meals = unique(offers.map((o) => humanMeal(o.meal)));
  const rooms = unique(offers.map((o) => humanRoom(o.room)));
  const prices = offers.map((o) => o.price).filter((n) => Number.isFinite(n));
  const minPrice = prices.length ? Math.min(...prices) : price ?? null;
  const maxPrice = prices.length ? Math.max(...prices) : minPrice;
  const offerCurrency = offers[0]?.currency ?? currency ?? null;
  const travelerText = [
    `${adults} ${adults === 1 ? "взрослый" : adults < 5 ? "взрослых" : "взрослых"}`,
    children > 0 ? `${children} ${children === 1 ? "ребёнок" : "детей"}` : null,
  ].filter(Boolean).join(", ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h4 className="text-sm font-semibold text-slate-800">Характеристики услуги</h4>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Fact label="Страна" value={country || "—"} />
        <Fact label="Город" value={city || "—"} />
        <Fact label="Дата начала" value={fmtDate(date)} />
        <Fact label="Количество ночей" value={String(nights)} />
        <Fact label="Дата окончания" value={endDate(date, nights)} />
        <Fact label="Туристы" value={travelerText} />
        <Fact label="Возможные типы питания" value={meals.length ? meals.join(", ") : "Уточняется"} />
        <Fact label="Тип комнаты и размещения" value={rooms.length ? rooms.join(", ") : "Уточняется"} />
        <Fact
          label="Цена"
          value={minPrice == null ? "—" : maxPrice != null && maxPrice > minPrice ? `от ${money(minPrice, offerCurrency)}` : money(minPrice, offerCurrency)}
        />
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  );
}
