/**
 * Журнал аудита (Гл. 3.18) — централизованная регистрация всех значимых действий
 * пользователей, автоматических процессов и внешних интеграций.
 *
 * Модель AuditLog в prisma/schema.prisma. Записи неизменяемы: обычные
 * пользователи не могут редактировать или удалять журнал. Экспорт в PDF/Excel/
 * CSV/JSON и поиск — на странице «Система → Журнал аудита».
 *
 * recordAudit() вызывается из API-роутов после успешного выполнения операции:
 * вход/выход из системы, изменение статусов заказов, массовые операции,
 * обработка исключений. События автоматизированных процессов (Business Event
 * Engine) сидируются в prisma/seed.ts и дополняются реальными действиями.
 */

import { prisma } from "@/lib/prisma";

export {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_ICONS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_CRITICALITY,
  AUDIT_SOURCES,
  auditCriticalityColor,
} from "@/lib/audit-meta";

// ── Подразделение по роли (Гл. 3.18 «Структура записи») ──

export function departmentForRole(role: string | null | undefined): string {
  const map: Record<string, string> = {
    ADMIN: "Администрация",
    DIRECTOR: "Руководство",
    SALES_MANAGER: "Отдел продаж",
    OPERATOR: "Отдел исполнения",
    BUYER: "Клиент",
    PARTNER: "Партнёры",
    FINANCE: "Финансовый отдел",
    MARKETER: "Маркетинг",
    ANALYST: "Аналитика",
    MODERATOR: "Модерация",
  };
  return map[role ?? ""] ?? "Система";
}

// ── Нумерация событий (Гл. 3.18 «Идентификатор события») ──
// Счётчик последовательных номеров AUD-000001… (детерминированно по базе).

let auditSeqCache: number | null = null;

/**
 * Следующий свободный номер события AUD-NNNNNN.
 * Счётчик читается из БД при первом вызове (кэш на процесс), далее
 * инкрементируется в памяти. Коллизии при параллельных запросах обрабатывает
 * recordAudit: при уникальном нарушении (P2002) кэш сбрасывается и номер
 * пересчитывается — событие не теряется.
 */
async function nextEventId(): Promise<string> {
  if (auditSeqCache === null) {
    const rows = await prisma.auditLog.findMany({ select: { eventId: true } });
    let max = 0;
    for (const r of rows) {
      const n = parseInt(r.eventId.replace("AUD-", ""), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    auditSeqCache = max;
  }
  auditSeqCache += 1;
  return `AUD-${String(auditSeqCache).padStart(6, "0")}`;
}

/** Повторная попытка записи при конфликте номера события (не более N раз). */
const AUDIT_ID_RETRIES = 3;

/** Интерфейс события журнала аудита. */
export interface AuditEntry {
  /** Исполнитель: пользователь системы (User) или строковый актор (Система/AI). */
  user?: { id: string; firstName: string; lastName?: string | null; role?: string } | null;
  actorName?: string;
  actorRole?: string;
  category: string;
  action: string;
  objectType?: string;
  objectId?: string;
  objectNumber?: string;
  fromData?: Record<string, unknown> | null;
  toData?: Record<string, unknown> | null;
  comment?: string;
  source?: string;
  ip?: string;
  userAgent?: string;
  criticality?: string;
  createdAt?: Date;
}

/**
 * Регистрирует событие в журнале аудита (Гл. 3.18).
 * Никогда не бросает исключений: журнал не должен ломать основную операцию.
 * При отсутствии пользователя используется актор из actorName («Система» и т.п.).
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const actor = entry.user ?? null;
  for (let attempt = 0; attempt < AUDIT_ID_RETRIES; attempt++) {
    try {
      const eventId = await nextEventId();
      await prisma.auditLog.create({
        data: {
          eventId,
          userId: actor?.id ?? null,
          actorName: actor ? `${actor.firstName} ${actor.lastName ?? ""}`.trim() : entry.actorName || "Система",
          actorRole: actor?.role ?? entry.actorRole ?? null,
          department: actor?.role ? departmentForRole(actor.role) : departmentForRole(entry.actorRole),
          category: entry.category,
          action: entry.action,
          objectType: entry.objectType ?? null,
          objectId: entry.objectId ?? null,
          objectNumber: entry.objectNumber ?? null,
          fromData: entry.fromData ? JSON.stringify(entry.fromData) : null,
          toData: entry.toData ? JSON.stringify(entry.toData) : null,
          comment: entry.comment ?? null,
          source: entry.source ?? "Web",
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ? entry.userAgent.slice(0, 400) : null,
          criticality: entry.criticality ?? "info",
          createdAt: entry.createdAt ?? undefined,
        },
      });
      return;
    } catch (error) {
      // Коллизия номера события (два параллельных запроса взяли один AUD-NNNNNN):
      // сбрасываем кэш и пересчитываем номер на следующей попытке.
      if ((error as { code?: string }).code === "P2002" && attempt < AUDIT_ID_RETRIES - 1) {
        auditSeqCache = null;
        continue;
      }
      console.error("recordAudit error:", error);
      return;
    }
  }
}

/** Собирает IP и User-Agent из заголовков запроса (для пользовательских действий). */
export function requestContext(request: Request): { ip?: string; userAgent?: string } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  return { ip, userAgent };
}


