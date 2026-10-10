import { normalizePhoneE164, DEFAULT_PHONE_REGION } from "../phone/phone";
import { normalizeEmail } from "../field-validation";
import type { Prisma } from "../../generated/prisma/client";

/**
 * M4.2 (ADR-0016 §5) — общий channel-independent Customer Resolver.
 *
 * Один резолвер для всех входов (Website / WhatsApp / Guest Checkout /
 * будущие каналы) вместо дублирования WhatsApp-матчинга:
 *
 *   normalize phone → search canonical Customer identity
 *   0  → UNMATCHED
 *   1  → MATCHED
 *   >1 → AMBIGUOUS
 *
 * Правила (ADR-0016):
 *  - телефон — ключ резолва (canonical E.164 через единственный нормализатор
 *    shared/phone; невалидный номер → не угадывать, только UNMATCHED);
 *  - email — contact-ключ (unique) с fallback-семантикой (reuse, никогда
 *    не merge);
 *  - ФИО/имя — НЕ ключ идентичности: одинаковое ФИО при разных номерах
 *    не является основанием для автослияния (no auto-merge by construction);
 *  - статусы совпадают с WhatsAppMatchingStatus (UNMATCHED/MATCHED/AMBIGUOUS),
 *    новые значения в M4.2 НЕ вводятся;
 *  - read-only: resolver сам Customer не создаёт и не изменяет —
 *    create-or-link остаётся CRM-owned (CrmService.ensureCustomerForBuyer).
 *
 * Производительность (§M4.2 «Performance»): основной lookup — indexed-запрос
 * по `phoneCanonical` (M4.1 index); fallback-скан ограничен строками с
 * `phoneCanonical IS NULL AND phone IS NOT NULL` (legacy/не-backфилнутые
 * строки, e2e-фикстуры) — полного скана таблицы больше нет.
 */

export type CustomerResolverStatus = "UNMATCHED" | "MATCHED" | "AMBIGUOUS";

export interface CustomerResolverResult {
  readonly status: CustomerResolverStatus;
  readonly customerId: string | null;
  /** Кандидаты (для AMBIGUOUS — все; для MATCHED — ровно один; иначе []). */
  readonly candidates: string[];
  /** Канонический E.164, по которому выполнен резолв (null, если не задан). */
  readonly canonicalPhone: string | null;
  /** Каким ключом найден customer (для диагностики; API наружу не выходит). */
  readonly source: "phone" | "email" | "user" | "none";
}

/** Resolver — читает только customer (+user для явного account-link). */
export type CustomerResolverDb = Pick<Prisma.TransactionClient, "customer" | "user">;

export interface ResolveCustomerInput {
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly userId?: string | null;
}

/**
 * Все Customer, чей канонический телефон равен canonicalPhone.
 *
 * Запрос №1 — indexed по phoneCanonical (M4.1); запрос №2 — legacy-fallback
 * для строк без phoneCanonical (raw phone нормализуется в памяти тем же
 * shared-нормализатором). Union без дублей.
 */
export async function findCustomerIdsByCanonicalPhone(
  db: Pick<Prisma.TransactionClient, "customer">,
  canonicalPhone: string,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): Promise<string[]> {
  const indexed = await db.customer.findMany({
    where: { phoneCanonical: canonicalPhone },
    select: { id: true },
  });
  const ids = new Set(indexed.map((row) => row.id));
  const legacy = await db.customer.findMany({
    where: { phoneCanonical: null, phone: { not: null } },
    select: { id: true, phone: true },
  });
  for (const row of legacy) {
    if (normalizePhoneE164(row.phone, defaultRegion) === canonicalPhone) ids.add(row.id);
  }
  return [...ids];
}

/** 0 → UNMATCHED, 1 → MATCHED, >1 → AMBIGUOUS (никогда не auto-link/merge). */
export async function resolveCustomerByPhone(
  db: Pick<Prisma.TransactionClient, "customer">,
  phone: string | null | undefined,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): Promise<CustomerResolverResult> {
  const canonicalPhone = normalizePhoneE164(phone, defaultRegion);
  if (!canonicalPhone) {
    return { status: "UNMATCHED", customerId: null, candidates: [], canonicalPhone: null, source: "phone" };
  }
  const ids = await findCustomerIdsByCanonicalPhone(db, canonicalPhone, defaultRegion);
  if (ids.length === 1) {
    return { status: "MATCHED", customerId: ids[0], candidates: ids, canonicalPhone, source: "phone" };
  }
  if (ids.length > 1) {
    return { status: "AMBIGUOUS", customerId: null, candidates: ids, canonicalPhone, source: "phone" };
  }
  return { status: "UNMATCHED", customerId: null, candidates: [], canonicalPhone, source: "phone" };
}

/**
 * Channel-independent вход: userId (явный account-link) → phone (ключ) →
 * email (contact-fallback, read-only reuse).
 *
 * Приоритеты: phone не заменяется email — если телефон дал MATCHED/AMBIGUOUS,
 * результат возвращается как есть (email-путь не «перебивает» ключ);
 * email-lookup выполняется только когда телефон не сматчился (0) либо
 * не передан. Автослияния нет по построению: resolver ничего не пишет.
 */
export async function resolveCustomer(
  db: CustomerResolverDb,
  input: ResolveCustomerInput,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): Promise<CustomerResolverResult> {
  if (input.userId) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { customerId: true },
    });
    if (user?.customerId) {
      return {
        status: "MATCHED",
        customerId: user.customerId,
        candidates: [user.customerId],
        canonicalPhone: null,
        source: "user",
      };
    }
  }

  if (input.phone !== null && input.phone !== undefined && input.phone !== "") {
    const byPhone = await resolveCustomerByPhone(db, input.phone, defaultRegion);
    if (byPhone.status !== "UNMATCHED") return byPhone;
  }

  if (input.email !== null && input.email !== undefined && input.email !== "") {
    const email = normalizeEmail(input.email);
    const byEmail = await db.customer.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) {
      return { status: "MATCHED", customerId: byEmail.id, candidates: [byEmail.id], canonicalPhone: null, source: "email" };
    }
  }

  return { status: "UNMATCHED", customerId: null, candidates: [], canonicalPhone: null, source: "none" };
}
