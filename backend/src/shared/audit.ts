/**
 * CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK — shared core (D5 integration).
 *
 * Дизайн-решение (см. docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md):
 * audit events immutable, transactionally-coupled с business mutation (same DB
 * tx), хранятся в per-entity immutable history tables (Order → order.OrderHistory;
 * будущее: Booking → booking history, Request → request history — те же
 * conventions/core). Данный модуль — переиспользуемый core: типы событий,
 * источники, безопасная сериализация old/new и PII-redaction.
 *
 * PII-safe (HARD): аудит НЕ должен становиться «второй неконтролируемой PII
 * базой». Sensitive поля (passportNumber/passportExpiry/birthDate/phone/email)
 * сохраняются только в redacted форме. Secrets никогда не аудируются.
 */

/** События бизнес-аудита (min: FIELD_CHANGE / LIFECYCLE_ACTION / SYSTEM_ACTION). */
export const AUDIT_EVENT_TYPES = {
  /** Изменение значения поля бизнес-сущности (field/oldValue/newValue). */
  FIELD_CHANGE: "FIELD_CHANGE",
  /** Команда жизненного цикла (action/fromStatus/toStatus). */
  LIFECYCLE_ACTION: "LIFECYCLE_ACTION",
  /** Автоматическое/системное изменение (reconcile, компенсация, worker). */
  SYSTEM_ACTION: "SYSTEM_ACTION",
} as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];

/** Источник/контекст изменения (structured source). */
export const AUDIT_SOURCES = {
  ORDER_FULL_PAGE: "ORDER_FULL_PAGE",
  ORDER_QUICK_PREVIEW: "ORDER_QUICK_PREVIEW",
  API: "API",
  SYSTEM: "SYSTEM",
  INTEGRATION: "INTEGRATION",
} as const;
export type AuditSource = (typeof AUDIT_SOURCES)[keyof typeof AUDIT_SOURCES];

/** Одно полевое изменение в структурированной записи аудита. */
export interface AuditFieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  /** true — чувствительное значение сохранено только в redacted форме. */
  redacted: boolean;
}

/** Поля, чувствительность которых требует masking/redaction (no plaintext). */
const SENSITIVE_AUDIT_FIELDS = new Set([
  "passportNumber",
  "passportExpiry",
  "birthDate",
  "phone",
  "phoneNumber",
  "email",
  "customerEmail",
  "travelerPhone",
]);

export function isSensitiveAuditField(field: string): boolean {
  return SENSITIVE_AUDIT_FIELDS.has(field) || /passport|birthDate|phone|email/i.test(field);
}

/**
 * Детерминированная безопасная сериализация old/new для
 * string/number/decimal/boolean/date/enum/nullable. Complex-объекты НЕ
 * сериализуются целиком (запрещено: giant raw before/after snapshot).
 */
export function serializeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "object") {
    // только allowlisted scalar-представления; объекты → не поддерживаются
    // (field-level projection обязан быть выполнен на уровне интеграции).
    return null;
  }
  return String(value);
}

/** Redacted представление чувствительного значения (маскировка). */
export function redactAuditValue(field: string, serialized: string | null): { value: string | null; redacted: boolean } {
  if (!isSensitiveAuditField(field)) return { value: serialized, redacted: false };
  if (serialized === null) return { value: null, redacted: true };
  if (field === "passportNumber") {
    // passportNumber: показываем только последние 4 символа (как часть redacted
    // формы), остальное маскируем — full passport number не сохраняется.
    const clean = serialized.replace(/[^A-Za-z0-9]/g, "");
    const tail = clean.length > 4 ? clean.slice(-4) : clean;
    return { value: `••••${tail}`, redacted: true };
  }
  // birthDate / passportExpiry / phone / email — полная маска (без частей).
  return { value: "••••", redacted: true };
}

/**
 * Полевое изменение в безопасной (PII-redacted) форме для записи в audit.
 */
export function auditFieldChange(field: string, oldValue: unknown, newValue: unknown): AuditFieldChange {
  const oldS = serializeAuditValue(oldValue);
  const newS = serializeAuditValue(newValue);
  const oldSafe = redactAuditValue(field, oldS);
  const newSafe = redactAuditValue(field, newS);
  return { field, oldValue: oldSafe.value, newValue: newSafe.value, redacted: oldSafe.redacted || newSafe.redacted };
}

/** Allowlisted diff двух записей (prev/next) по заданным полям. */
export function diffAuditFields(
  allowlist: readonly string[],
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  for (const field of allowlist) {
    const oldV = prev[field];
    const newV = next[field];
    if (serializeAuditValue(oldV) !== serializeAuditValue(newV)) {
      changes.push(auditFieldChange(field, oldV, newV));
    }
  }
  return changes;
}
