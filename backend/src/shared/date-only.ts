/**
 * Каноническая date-only семантика (STRICT REVIEW 2.5 §17): единый источник
 * истины, переиспользуется sales.checkout.isDateOnly и order.service (валидация
 * OrderRequested.serviceDate). Без time-компонента и без timezone-конверсии.
 *
 * Round-trip проверка: regex + реальный календарный день (new Date(...) +
 * toISOString().slice(0,10) === value) — отклоняет 2026-02-29 / 2026-13-01 /
 * 2026-00-10 / 2026-04-31 (иначе `new Date` молча сдвинул бы 2026-02-29 →
 * 2026-03-01), принимает валидный високосный день (2028-02-29).
 */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
