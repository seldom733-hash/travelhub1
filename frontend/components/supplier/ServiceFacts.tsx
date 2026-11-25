"use client";

import type { SupplierPriceCalendarEntryOffer } from "@/lib/supplier-api";
import { useLocale } from "@/lib/i18n";
import { humanMeal, humanRoom, sx } from "@/lib/supplier-labels";

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

function money(value: number | null | undefined, currency: string | null | undefined, locale: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const tag = locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU";
  const formatted = value.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const locale = useLocale();
  if (!date) return null;

  const meals = unique(offers.map((o) => humanMeal(o.meal, locale)));
  const rooms = unique(offers.map((o) => humanRoom(o.room, locale)));
  const prices = offers.map((o) => o.price).filter((n) => Number.isFinite(n));
  const minPrice = prices.length ? Math.min(...prices) : price ?? null;
  const maxPrice = prices.length ? Math.max(...prices) : minPrice;
  const offerCurrency = offers[0]?.currency ?? currency ?? null;
  const travelerText = [
    `${adults} ${sx(locale, "взрослых", "yetkin", "adults")}`,
    children > 0 ? `${children} ${sx(locale, "детей", "uşaq", "children")}` : null,
  ].filter(Boolean).join(", ");

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h4 className="text-sm font-semibold text-ink">
        {sx(locale, "Характеристики услуги", "Xidmətin xüsusiyyətləri", "Service details")}
      </h4>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Fact label={sx(locale, "Страна", "Ölkə", "Country")} value={country || "—"} />
        <Fact label={sx(locale, "Город", "Şəhər", "City")} value={city || "—"} />
        <Fact label={sx(locale, "Дата начала", "Başlama tarixi", "Start date")} value={fmtDate(date)} />
        <Fact label={sx(locale, "Количество ночей", "Gecə sayı", "Nights")} value={String(nights)} />
        <Fact label={sx(locale, "Дата окончания", "Bitmə tarixi", "End date")} value={endDate(date, nights)} />
        <Fact label={sx(locale, "Туристы", "Sərnişinlər", "Travelers")} value={travelerText} />
        <Fact
          label={sx(locale, "Возможные типы питания", "Mümkün yemək növləri", "Meal options")}
          value={meals.length ? meals.join(", ") : sx(locale, "Уточняется", "Dəqiqləşdirilir", "To be confirmed")}
        />
        <Fact
          label={sx(locale, "Тип комнаты и размещения", "Otaq və yerləşmə növü", "Room and accommodation")}
          value={rooms.length ? rooms.join(", ") : sx(locale, "Уточняется", "Dəqiqləşdirilir", "To be confirmed")}
        />
        <Fact
          label={sx(locale, "Цена", "Qiymət", "Price")}
          value={
            minPrice == null
              ? "—"
              : maxPrice != null && maxPrice > minPrice
                ? `${sx(locale, "от", "başlayaraq", "from")} ${money(minPrice, offerCurrency, locale)}`
                : money(minPrice, offerCurrency, locale)
          }
        />
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
