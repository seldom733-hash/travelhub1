import { ValidationDomainError } from "./errors";

/**
 * Анти-disintermediation (ЕДИНАЯ каноническая реализация).
 *
 * Используется:
 *  - reverse.SellerProposal content (Step 2.2D) — PROPOSAL EXISTS ≠ CONTACT DISCLOSED;
 *  - pre-sale chat messages (Step 2.2E) — CHAT EXISTS ≠ CONTACT DISCLOSED
 *    (Roadmap Amend 3.37B: anti-disintermediation распространяется на pre-sale
 *    BuyerRequest chat).
 *
 * Консервативная regex-проверка: email / phone / URL / domain-мессенджеры /
 * social handles → обнаружение → 422 (loud, НЕ silent-strip). Ограничение
 * документировано: это базовая regex-защита, НЕ DLP — не гарантирует полное
 * обнаружение обхода платформы.
 *
 * ISO date-only (YYYY-MM-DD) НЕ считается телефоном (регекс дат ложно
 * матчится phone-паттерном в свободном тексте, например «даты: 2026-09-01»).
 */
export const CONTACT_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { label: "phone", re: /(?<![A-Za-z0-9])(\+?\d[\d\s().-]{7,}\d)(?![A-Za-z0-9])/ },
  { label: "url", re: /(https?:\/\/|www\.)[A-Za-z0-9.-]+/i },
  { label: "social/telegram/whatsapp", re: /(t\.me\/|wa\.me\/|@[A-Za-z0-9_]{4,}|instagram\.com|facebook\.com|vk\.com|youtube\.com)/i },
];

/** ISO date-only (YYYY-MM-DD) — НЕ контакт. Учитывается в phone-проверке. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Возвращает label первого найденного контактного паттерна или null. */
export function hasForbiddenText(value: string): string | null {
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

/** Обёртка-валидатор для текстовых полей: кидает ValidationDomainError (422). */
export function assertNoContactText(fieldLabel: string, value: string): void {
  const hit = hasForbiddenText(value);
  if (hit) {
    throw new ValidationDomainError(`${fieldLabel} must not contain contact information or links (${hit})`);
  }
}
