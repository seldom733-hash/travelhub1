/**
 * Нормализация Prisma-ошибок (Phase 1 Step 1.12.1 REVIEW FIX 10).
 *
 * Проблема: Prisma 7 + driver adapter отдаёт P2002 с ДРУГИМ meta-shape, чем
 * классический клиент:
 *   - классический:  { code: "P2002", meta: { target: ["Table_column_key"] } }
 *   - driver adapter: { code: "P2002", meta: { driverAdapterError: { cause:
 *                       { originalMessage: '... нарушает ограничение уникальности
 *                         "Table_column_key"' } } } }
 *
 * Цель: DB unique race НИКОГДА не превращается в raw 500. Единый helper
 * извлекает имена затронутых unique-constraint'ов независимо от shape.
 * Используется: StorefrontService (partnerId/slug), CatalogService.createCategory
 * и любыми другими местами с тем же паттерном.
 */
export interface PrismaUniqueError {
  /** Код Prisma (P2002 — unique violation; иное — не unique-ошибка). */
  code: string | undefined;
  /** Имена затронутых constraint'ов (например "PartnerStorefront_slug_key"). */
  constraintNames: string[];
}

/**
 * Извлекает имена unique-constraint'ов из Prisma-ошибки. Возвращает [] для
 * не-P2002 ошибок или неизвестных shapes. Работает и с классическим meta.target,
 * и с driverAdapterError.cause.originalMessage (обёртки/цитирование — не важны).
 */
export function uniqueConstraintNames(err: unknown): string[] {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (code !== "P2002") return [];
  const meta = (err as { meta?: { target?: unknown; driverAdapterError?: { cause?: { originalMessage?: string } } } } | null | undefined)?.meta;
  const names: string[] = [];
  if (Array.isArray(meta?.target)) {
    for (const t of meta.target) if (typeof t === "string") names.push(t);
  } else if (typeof meta?.target === "string") {
    names.push(meta.target);
  }
  const msg = meta?.driverAdapterError?.cause?.originalMessage;
  if (msg) {
    const quoted = msg.match(/"[^"]+"/g) ?? [];
    for (const q of quoted) names.push(q.replace(/"/g, ""));
  }
  // Дедупликация с сохранением порядка.
  return [...new Set(names)];
}

/** Удобный предикат: ошибка является unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown } | null | undefined)?.code === "P2002";
}

/** Парсинг ошибки в структурированный вид (для тестов и отчётов). */
export function parseUniqueError(err: unknown): PrismaUniqueError {
  return {
    code: (err as { code?: string } | null | undefined)?.code,
    constraintNames: uniqueConstraintNames(err),
  };
}
