/**
 * Shared date helpers for default values of date inputs (search forms).
 *
 * todayISO() — the LOCAL calendar date as `YYYY-MM-DD`, matching the value
 * format of native `<input type="date">`.
 *
 * Deliberately not `new Date().toISOString().slice(0, 10)`: that is the UTC
 * date, which drifts to "tomorrow" in the evening and to "yesterday" after
 * midnight in AZ/RU timezones (UTC+4/+3...).
 */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * tomorrowISO() — the LOCAL calendar date +1 day as `YYYY-MM-DD`.
 * Default departure date for the universal search form («вылет от»).
 */
export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
