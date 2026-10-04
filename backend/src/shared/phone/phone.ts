import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Canonical phone normalization (мастер-промпт v2.3 D4).
 *
 * Единый формат — E.164 (+<код><номер>). Обрабатывает: `+`, пробелы, `-`,
 * `()`, национальный формат с ведущим 0 (`050 123 45 67`), цифры без `+`
 * (`994501234567`) и префикс `00`. Default region приходит из конфигурации
 * платформы (`WHATSAPP_DEFAULT_PHONE_REGION`, ожидаемо AZ/+994).
 *
 * Возвращает canonical E.164-строку либо null, если номер невалиден
 * (мусор, слишком короткий, не тот регион) — вызывающий код решает, что
 * делать (UNMATCHED и т.п.), угадывать нельзя.
 */

export const DEFAULT_PHONE_REGION = "AZ";

const SEPARATORS = /[\s().\-\u00a0\u2010-\u2015]/g;

/** Нормализует телефон в canonical E.164; null — если номер невалиден. */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const region = ((defaultRegion || DEFAULT_PHONE_REGION).toUpperCase()) as CountryCode;

  // Варианты кандидата: как есть, `00…` → `+…`, голые цифры → `+…`.
  const compact = trimmed.replace(SEPARATORS, "");
  const candidates: string[] = [];
  if (trimmed.startsWith("+")) candidates.push(trimmed);
  else if (compact.startsWith("00")) candidates.push(`+${compact.slice(2)}`);
  else {
    candidates.push(trimmed); // национальный формат с учётом defaultRegion
    if (/^\d{7,15}$/.test(compact)) candidates.push(`+${compact}`);
  }

  for (const candidate of candidates) {
    try {
      const parsed = parsePhoneNumberFromString(candidate, region);
      if (parsed && parsed.isValid()) return parsed.number; // canonical E.164
    } catch {
      // Неизвестный регион/не разбирается — пробуем следующий кандидат.
    }
  }
  return null;
}

/** Проверка валидности (без побочных эффектов). */
export function isValidPhone(
  raw: string | null | undefined,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): boolean {
  return normalizePhoneE164(raw, defaultRegion) !== null;
}
