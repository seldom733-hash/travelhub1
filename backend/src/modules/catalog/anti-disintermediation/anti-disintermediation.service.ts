/**
 * AntiDisintermediationService (Phase 1 Step 1.11 §11–§13) — детерминированный
 * текстовый детектор попыток вывести Buyer за пределы TravelHub.
 *
 * Политика: Product content (title, description, captions, alt text) и public
 * seller description НЕ должны содержать:
 *   - email / phone / web URL (EXTERNAL_CONTACT_INFO);
 *   - внешние booking-ссылки/домены маркетплейсов (EXTERNAL_BOOKING_LINK);
 *   - QR-коды / упоминания контактных медиа (QR_CODE_OR_CONTACT_MEDIA);
 *   - мессенджеры / social handles / «напишите напрямую» (DISINTERMEDIATION_ATTEMPT).
 *
 * Только deterministic checks (regex, никакого AI/OCR — Step 1.11 §12/§21).
 * False positive → controlled validation (блокировка submit с перечнем нарушений),
 * НЕ silent mutation: контент никогда не изменяется автоматически.
 *
 * Поля attributes/availability/tariffs НЕ сканируются: category-specific данные
 * (адрес отеля, контакт объекта и т.п.) — легитимные product-атрибуты, не
 * маркетинговый free-text. Сканируются только free-text поля витрины.
 */
import { Injectable } from "@nestjs/common";
import { ValidationDomainError } from "../../../shared/errors";

/** Reason code (стабильный backend-код, синхронизирован с MODERATION_REASON_CODES). */
export type AntiDisintermediationCode =
  | "EXTERNAL_CONTACT_INFO"
  | "EXTERNAL_BOOKING_LINK"
  | "QR_CODE_OR_CONTACT_MEDIA"
  | "DISINTERMEDIATION_ATTEMPT";

export interface DetectedViolation {
  code: AntiDisintermediationCode;
  /** Совпавший фрагмент (усечённый) — для отчёта модератору/партнёру. */
  match: string;
  /** Поле, в котором найдено (title/description/caption/altText/publicDescription). */
  field: string;
}

/** Внешние booking/marketplace домены → EXTERNAL_BOOKING_LINK. */
const EXTERNAL_BOOKING_DOMAINS =
  /(?:booking|airbnb|expedia|agoda|getyourguide|viator|kayak|hostelworld|rentalcars|tripadvisor|hotels)\./i;

/** Email: a@b.c (минимум 2 символа домена). */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+){1,}/i;

/** URL: http(s)://, www., или domain-like (word.word/TLD). */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![@\w.])(?:[a-z0-9-]+\.)+(?:com|net|org|ru|az|io|travel|info|biz|online|site|co|eu)(?![a-z0-9])/i;

/**
 * Phone-like (детерминированно, без false positive на «N+1 <число>» и длинные
 * цифровые прогоны):
 *  - tel:/phone: с явным префиксом;
 *  - «+код» с ГРУППИРОВАННЫМИ цифрами (минимум 3 группы по 2–4 цифры) — настоящие
 *    номера («+7 999 123-45-67», «+1-800-555-0199»), а не «+1 1786214794685»;
 *  - RU/CIS формат 8/7 (XXX) XXX-XX-XX.
 */
const PHONE_RE =
  /(?:tel:|phone:)\s*\+?[\d\s()./-]{7,}|\+\d{1,3}(?:[\s-]\d{2,4}){2,}|\b(?:8|7)[\s(.-]?\d{3}[\s).-]?\s?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/;

/** Messenger/social маркеры. */
const MESSENGER_RE =
  /(?:whatsapp|telegram|viber|wechat|instagram|facebook|tiktok|youtube|t\.me\/|wa\.me\/)|\b@[a-z][a-z0-9_.]{1,}\b/i;

/** QR / контактные медиа упоминания. (Cyrillic не входит в \w в JS — границы только вокруг ASCII.) */
const QR_RE = /\bqr[\s-]?(?:code|код)|\bqr\b\s*(?:code|код)/gi;

/** Призывы «напишите/найдите напрямую» (RU/EN/AZ). */
const DIRECT_PHRASE_RE =
  /(?:напишите\s+(?:нам\s+)?напрямую|свяжитесь\s+(?:с\s+нами\s+)?напрямую|найдите\s+нас|ищите\s+нас|вне\s+платформы|вне\s+сайта|пишите\s+нам|звоните\s+нам|обойди\s+платформу|contact\s+us\s+directly|find\s+us\s+on|message\s+us\s+directly|book\s+directly|outside\s+the\s+platform|off\s+platform|birbaşa|bizimlə\s+əlaqə|bizə\s+yazın)/i;

const MAX_MATCH_LENGTH = 40;

function clip(match: string): string {
  return match.length > MAX_MATCH_LENGTH ? match.slice(0, MAX_MATCH_LENGTH) + "…" : match;
}

@Injectable()
export class AntiDisintermediationService {
  /** Детектирование нарушений в одном тексте. Пустой текст → []. */
  detect(text: string | null | undefined, field: string): DetectedViolation[] {
    if (!text || text.trim().length === 0) return [];
    const out: DetectedViolation[] = [];
    const push = (code: AntiDisintermediationCode, re: RegExp): void => {
      for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) {
        const match = clip(m[0] ?? "");
        // email внутри URL-детектора: «mailto:» ловится как URL — не дублируем.
        if (code === "EXTERNAL_CONTACT_INFO" && /^mailto:/i.test(match)) {
          out.push({ code, match: clip(match.replace(/^mailto:/i, "")), field });
          continue;
        }
        out.push({ code, match, field });
      }
    };
    push("EXTERNAL_CONTACT_INFO", EMAIL_RE);
    push("EXTERNAL_CONTACT_INFO", PHONE_RE);
    if (URL_RE.test(text)) {
      // Различаем внешние booking-ссылки и прочие URL.
      const urlMatch = text.match(URL_RE);
      if (urlMatch && EXTERNAL_BOOKING_DOMAINS.test(urlMatch[0])) {
        out.push({ code: "EXTERNAL_BOOKING_LINK", match: clip(urlMatch[0]), field });
      } else {
        out.push({ code: "EXTERNAL_CONTACT_INFO", match: clip(urlMatch?.[0] ?? ""), field });
      }
    }
    push("QR_CODE_OR_CONTACT_MEDIA", QR_RE);
    push("DISINTERMEDIATION_ATTEMPT", MESSENGER_RE);
    push("DISINTERMEDIATION_ATTEMPT", DIRECT_PHRASE_RE);
    // Дедупликация (один и тот же код+поле может пойматься несколькими regex).
    const seen = new Set<string>();
    return out.filter((v) => {
      const key = `${v.code}|${v.field}|${v.match}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Скан нескольких free-text полей (title/description/captions/altText/...). */
  scanFields(fields: Array<{ value: string | null | undefined; field: string }>): DetectedViolation[] {
    const all: DetectedViolation[] = [];
    for (const f of fields) all.push(...this.detect(f.value, f.field));
    const seen = new Set<string>();
    return all.filter((v) => {
      const key = `${v.code}|${v.field}|${v.match}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Блокирующая проверка: если найдены нарушения → ValidationDomainError с перечнем. */
  assertNoViolations(fields: Array<{ value: string | null | undefined; field: string }>): void {
    const violations = this.scanFields(fields);
    if (violations.length === 0) return;
    const summary = violations
      .map((v) => `${v.field}: [${v.code}] "${v.match}"`)
      .join("; ");
    throw new ValidationDomainError(
      `Content violates the TravelHub anti-disintermediation policy (no external contacts, booking links, QR/contact media, messengers or direct-contact prompts): ${summary}`,
    );
  }
}
