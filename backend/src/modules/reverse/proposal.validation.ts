/**
 * PHASE 2 STEP 2.2D — Seller Proposal: чистые валидаторы.
 *
 * - amount: НЕ-binding индикативная сумма, Decimal (не JS float), non-negative,
 *   верхняя граница (Decimal(12,2) — та же конвенция, что Tariff/Order);
 *   NULL = PRICE_ON_REQUEST (честное отсутствие, НЕ фабрикуется ноль);
 * - currency: ISO 4217 (3 заглавные буквы); обязательна при amount;
 *   НЕ допускается silent currency conversion (просто валидация формата);
 * - контент: plain text, size-limited, без HTML/script (анти-injection),
 *   анти-disintermediation (запрет email/phone/URL/social handles —
 *   PROPOSAL EXISTS ≠ CONTACT DISCLOSED); НЕ DLP-safe store (документировано);
 * - validUntil: date-only (YYYY-MM-DD → UTC midnight), НЕ Sales Quote expiry
 *   semantics; hint, не обязательный.
 */
import { ValidationDomainError } from "../../shared/errors";

export const MAX_PROPOSAL_TEXT_LENGTH = 4000;
/// Decimal(12,2) ёмкость: 10 цифр до запятой + 2 после = макс 9_999_999_999.99.
/// (валидация должна совпадать с ёмкостью БД — иначе overflow → 500 вместо 422).
export const MAX_AMOUNT = 9_999_999_999.99;
const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Паттерны контактов/URL для анти-disintermediation (консервативная проверка).
 * Обнаружение → 422 (loud), НЕ silent-strip: Proposal не должен содержать
 * каналы обхода платформы (email, телефон, мессенджеры, URL, соцсети).
 * Ограничение документировано: это базовая regex-защита, НЕ DLP.
 */
export const CONTACT_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { label: "phone", re: /(?<![A-Za-z0-9])(\+?\d[\d\s().-]{7,}\d)(?![A-Za-z0-9])/ },
  { label: "url", re: /(https?:\/\/|www\.)[A-Za-z0-9.-]+/i },
  { label: "social/telegram/whatsapp", re: /(t\.me\/|wa\.me\/|@[A-Za-z0-9_]{4,}|instagram\.com|facebook\.com|vk\.com|youtube\.com)/i },
];

/** ISO date-only (YYYY-MM-DD) — НЕ контакт. Учитывается в phone-проверке. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function hasForbiddenText(value: string): string | null {
  for (const p of CONTACT_PATTERNS) {
    if (!p.re.test(value)) continue;
    // Phone-паттерн ложно ловит ISO-даты (YYYY-MM-DD) в свободном тексте
    // (например «даты: 2026-09-01»). Даты НЕ контакт — пропускаем такое совпадение.
    if (p.label === "phone") {
      const matches = value.match(new RegExp(p.re.source, "g")) ?? [];
      const nonDate = matches.some((m) => !ISO_DATE_RE.test(m.trim()));
      if (!nonDate) continue;
    }
    return p.label;
  }
  return null;
}

/** Проверка одного текстового поля: тип, длина, plain-text, анти-disintermediation. */
function normalizeTextField(raw: unknown, label: string, max = MAX_PROPOSAL_TEXT_LENGTH): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") {
    throw new ValidationDomainError(`${label} must be a string`);
  }
  const value = raw.trim();
  if (value.length > max) {
    throw new ValidationDomainError(`${label} must be at most ${max} characters`);
  }
  // Control chars (кроме \t\n\r) запрещены — недопустимые управляющие
  // последовательности в free-text (JSON-безопасность, anti-spoofing).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new ValidationDomainError(`${label} must not contain control characters`);
  }
  // Анти-injection: запрещён HTML/script markup в free-text полях.
  if (/<[^>]*>/i.test(value) || /<\/?script/i.test(value) || /javascript:/i.test(value)) {
    throw new ValidationDomainError(`${label} must be plain text (no HTML/script markup)`);
  }
  // Анти-disintermediation: контакты/URL запрещены (PROPOSAL EXISTS ≠ CONTACT DISCLOSED).
  const hit = hasForbiddenText(value);
  if (hit) {
    throw new ValidationDomainError(`${label} must not contain contact information or links (${hit})`);
  }
  return value;
}

export interface ProposalContent {
  description: string;
  includedServices: string;
  exclusions: string;
  conditions: string;
  notes: string;
}

/**
 * Нормализация контента Proposal. Пустые строки → null (честное отсутствие).
 * Кидает ValidationDomainError (422) при структурных ошибках.
 */
export function normalizeProposalContent(raw: unknown): {
  description: string | null;
  includedServices: string | null;
  exclusions: string | null;
  conditions: string | null;
  notes: string | null;
} {
  if (raw === null || raw === undefined) {
    return { description: null, includedServices: null, exclusions: null, conditions: null, notes: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationDomainError("proposal content must be an object");
  }
  const o = raw as Record<string, unknown>;
  const allowed = new Set(["description", "includedServices", "exclusions", "conditions", "notes"]);
  const unknown = Object.keys(o).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new ValidationDomainError(`proposal content has unknown keys: ${unknown.join(", ")}`);
  }
  // Пустой контент легален (Proposal может быть чисто денежным, §14: отсутствие
  // контента честно сохраняется как null; PRICE_ON_REQUEST-only Proposal валиден).
  const out: ProposalContent = {
    description: normalizeTextField(o.description, "description"),
    includedServices: normalizeTextField(o.includedServices, "includedServices"),
    exclusions: normalizeTextField(o.exclusions, "exclusions"),
    conditions: normalizeTextField(o.conditions, "conditions"),
    notes: normalizeTextField(o.notes, "notes"),
  };
  return {
    description: out.description || null,
    includedServices: out.includedServices || null,
    exclusions: out.exclusions || null,
    conditions: out.conditions || null,
    notes: out.notes || null,
  };
}

export interface ProposalMoney {
  amount: string | null; // stringified Decimal (как Prisma Decimal) или null (PRICE_ON_REQUEST)
  currency: string | null;
}

/**
 * Нормализация индикативной суммы. amount отсутствует/undefined → PRICE_ON_REQUEST
 * (честный null, НЕ ноль). Валидация на входе (число или numeric string), далее
 * сервис конвертирует в Prisma Decimal.
 */
export function normalizeProposalMoney(raw: unknown): ProposalMoney {
  if (raw === undefined || raw === null) {
    return { amount: null, currency: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationDomainError("proposal money must be an object { amount?, currency? }");
  }
  const o = raw as Record<string, unknown>;
  const allowed = new Set(["amount", "currency"]);
  const unknown = Object.keys(o).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new ValidationDomainError(`proposal money has unknown keys: ${unknown.join(", ")}`);
  }
  const amountRaw = o.amount;
  const currencyRaw = o.currency;

  if (amountRaw === undefined || amountRaw === null) {
    // Без amount currency не имеет смысла.
    if (currencyRaw !== undefined && currencyRaw !== null) {
      throw new ValidationDomainError("currency requires amount");
    }
    return { amount: null, currency: null };
  }

  let amount: number;
  if (typeof amountRaw === "number") {
    amount = amountRaw;
  } else if (typeof amountRaw === "string" && amountRaw.trim() !== "" && !Number.isNaN(Number(amountRaw))) {
    amount = Number(amountRaw);
  } else {
    throw new ValidationDomainError("amount must be a non-negative number");
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationDomainError("amount must be a non-negative number");
  }
  if (amount > MAX_AMOUNT) {
    throw new ValidationDomainError(`amount exceeds the maximum allowed value (${MAX_AMOUNT})`);
  }
  // Не более 2 знаков после запятой (Decimal(12,2)).
  const rawStr = String(amount);
  const dot = rawStr.indexOf(".");
  const frac = dot === -1 ? "" : rawStr.slice(dot + 1);
  if (frac.length > 2) {
    throw new ValidationDomainError("amount supports at most 2 decimal places");
  }

  if (typeof currencyRaw !== "string" || !CURRENCY_RE.test(currencyRaw)) {
    throw new ValidationDomainError("currency must be a 3-letter ISO 4217 code (e.g. USD, EUR, AZN)");
  }

  return { amount: amount.toFixed(2), currency: currencyRaw };
}

/** Нормализация validity hint: date-only YYYY-MM-DD → UTC midnight (canonical). */
export function normalizeProposalValidUntil(raw: unknown): Date | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || !DATE_ONLY_RE.test(raw)) {
    throw new ValidationDomainError("validUntil must be a date in YYYY-MM-DD format");
  }
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationDomainError("validUntil is not a valid date");
  }
  return d;
}

// ── Exports для unit-тестов ─────────────────────────────────────────────

export { normalizeTextField, hasForbiddenText };
