/**
 * Автоматизация процессов исполнения (Гл. 3.16) и управление исключительными
 * ситуациями (Гл. 3.17) — модуль раздела «Продажи и исполнение».
 *
 * Business Event Engine (3.16): событие → проверка условий → бизнес-правила →
 * обновление данных → уведомления → запись в журнал.
 * Exception Management Engine (3.17): обнаружение → классификация → оценка
 * критичности → сценарий → уведомления → журнал.
 *
 * Данные детерминированные (демо-режим): журнал и исключения выводятся из
 * фактических заказов периода, поэтому карточки всегда согласованы с реестром.
 */

import { ORDER_STATUS_GROUPS, pickManager } from "@/lib/admin-data";

// ── Типы ──

/** Сценарий автоматизации (Гл. 3.16 «Правила обработки») */
export interface AutomationScenario {
  key: string;
  icon: string;
  title: string;
  description: string;
  group: string;
  enabled: boolean;
}

/** Запись журнала автоматических операций (Гл. 3.16 «Мониторинг») */
export interface AutomationEvent {
  id: string;
  at: string;
  event: string;
  action: string;
  result: "success" | "error" | "skipped";
  durationMs: number;
  source: string;
  orderNumber?: string;
}

/** Категории исключительных ситуаций (Гл. 3.17) */
export const EXCEPTION_CATEGORIES = [
  "Ошибки бронирования",
  "Ошибки оплаты",
  "Ошибки формирования документов",
  "Ошибки интеграции",
  "Ошибки взаимодействия с поставщиками",
  "Нарушения SLA",
  "Ошибки пользователя",
  "Системные ошибки",
  "Конфликт данных",
  "Ошибки безопасности",
] as const;

/** Уровни критичности (Гл. 3.17 «Панель контроля исключений») */
export type Criticality = "low" | "medium" | "high" | "critical";
/** Статусы обработки исключения (Гл. 3.17) */
export type ExceptionStatus = "new" | "working" | "resolved" | "closed";

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

export const CRITICALITY_COLORS: Record<Criticality, string> = {
  low: "#64748b",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#dc2626",
};

export const EXCEPTION_STATUS_LABELS: Record<ExceptionStatus, string> = {
  new: "Новый",
  working: "В работе",
  resolved: "Решён",
  closed: "Закрыт",
};

export const EXCEPTION_STATUS_COLORS: Record<ExceptionStatus, string> = {
  new: "#3b82f6",
  working: "#f59e0b",
  resolved: "#22c55e",
  closed: "#64748b",
};

/** Запись панели контроля исключений (Гл. 3.17) */
export interface SalesException {
  id: string;
  type: string;
  category: string;
  criticality: Criticality;
  orderNumber: string;
  orderId: string;
  manager: string;
  createdAt: string;
  status: ExceptionStatus;
  description: string;
  aiSuggestion: string;
}

/** Строка реестра заказов — вход для построения журнала/исключений */
export interface OrderLike {
  id: string;
  orderNumber: string;
  client: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  manager: string;
  amount: number;
  serviceDate: string | null;
}

// ── Сценарии автоматизации (Гл. 3.16) ──

export const AUTOMATION_SCENARIOS: AutomationScenario[] = [
  {
    key: "assign_manager",
    icon: "👤",
    title: "Авто-назначение исполнителя",
    description: "При создании заказа исполнитель назначается по специализации, направлению и текущей загрузке. При отсутствии подходящего — заказ в очередь распределения.",
    group: "Исполнители",
    enabled: true,
  },
  {
    key: "status_transitions",
    icon: "🔁",
    title: "Авто-переход статусов",
    description: "Все услуги подтверждены → Подтверждён; полная оплата → Оплачен; документы сформированы → Готов к исполнению; услуги оказаны → Завершён.",
    group: "Статусы",
    enabled: true,
  },
  {
    key: "doc_generation",
    icon: "📄",
    title: "Авто-генерация документов",
    description: "После подтверждения — договор и счёт; после оплаты — ваучеры, авиабилеты, страховой полис, маршрут; после поездки — акт и запрос на отзыв.",
    group: "Документы",
    enabled: true,
  },
  {
    key: "notifications",
    icon: "🔔",
    title: "Авто-уведомления",
    description: "Клиент, менеджер, руководитель, поставщик и финансовый отдел получают уведомления о смене статусов, оплатах и нарушении SLA.",
    group: "Уведомления",
    enabled: true,
  },
  {
    key: "sla_control",
    icon: "⏱",
    title: "Контроль SLA",
    description: "Непрерывный контроль нормативов: при риске нарушения — повышение приоритета, уведомление исполнителя и руководителя, создание задачи, предупреждение на Dashboard.",
    group: "SLA",
    enabled: true,
  },
  {
    key: "task_creation",
    icon: "📋",
    title: "Авто-создание задач",
    description: "Задачи формируются при отсутствии подтверждения поставщика, приближении срока оплаты, повторной генерации документов, запросе клиента и нарушении SLA.",
    group: "Задачи",
    enabled: true,
  },
];

// ── Журнал автоматических операций (Гл. 3.16 «Мониторинг») ──

const PAID_STATUSES = [...ORDER_STATUS_GROUPS.paid];
const AWAITING_STATUSES = [...ORDER_STATUS_GROUPS.awaitingPayment];

/** Детерминированное время выполнения операции (имитация замеров). */
function fakeDuration(seed: string, min = 15, max = 950): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return min + (h % (max - min));
}

/** Источник события (системный сервис или AI-движок). */
function fakeSource(seed: string): string {
  return seed.length % 4 === 0 ? "AI Center" : "Business Event Engine";
}

/**
 * Построение журнала автоматических операций по заказам периода.
 * Для каждого заказа детерминированно выводятся события его жизненного цикла
 * (создание, подтверждение, оплата, документы, завершение) в хронологическом
 * порядке — от новых к старым.
 */
export function buildAutomationJournal(orders: OrderLike[]): AutomationEvent[] {
  const events: AutomationEvent[] = [];
  const now = Date.now();
  let seq = 0;
  const push = (e: Omit<AutomationEvent, "id">) => {
    events.push({ id: `auto-${seq++}`, ...e });
  };

  for (const o of orders.slice(0, 60)) {
    const updatedAt = new Date(o.updatedAt).getTime();
    const paid = PAID_STATUSES.includes(o.status as (typeof PAID_STATUSES)[number]);
    const active = [...ORDER_STATUS_GROUPS.active].includes(o.status as (typeof ORDER_STATUS_GROUPS.active)[number]);
    const overdue = o.status === "OVERDUE";

    // Создание заказа → авто-назначение исполнителя (3.16)
    push({
      at: o.createdAt,
      event: "Создание заказа",
      action: `Авто-назначение исполнителя → ${o.manager}`,
      result: "success",
      durationMs: fakeDuration(o.id + "a"),
      source: "Business Event Engine",
      orderNumber: o.orderNumber,
    });

    // Окончание срока SLA → повышение приоритета, задача, уведомление (3.16 «Контроль SLA»)
    if (overdue) {
      push({
        at: o.updatedAt,
        event: "Окончание срока SLA",
        action: `Повышение приоритета, создание задачи, уведомление руководителя (${o.orderNumber})`,
        result: "success",
        durationMs: fakeDuration(o.id + "b"),
        source: "Business Event Engine",
        orderNumber: o.orderNumber,
      });
    }

    // Полная оплата → авто-переход статуса + генерация документов (3.16)
    if (paid) {
      const docAt = new Date(Math.min(updatedAt, now));
      push({
        at: docAt.toISOString(),
        event: "Поступление полной оплаты",
        action: "Авто-переход статуса → Оплачен · генерация ваучера, авиабилетов, страхового полиса",
        result: "success",
        durationMs: fakeDuration(o.id + "c"),
        source: fakeSource(o.id + "c"),
        orderNumber: o.orderNumber,
      });
    }

    // Ожидание оплаты → напоминание клиенту (3.16 «Автоматические уведомления»)
    if (AWAITING_STATUSES.includes(o.status as (typeof AWAITING_STATUSES)[number]) && !overdue) {
      push({
        at: o.updatedAt,
        event: "Приближение срока оплаты",
        action: "Авто-уведомление клиенту с ссылкой на оплату",
        result: "success",
        durationMs: fakeDuration(o.id + "d"),
        source: "Business Event Engine",
        orderNumber: o.orderNumber,
      });
    }

    // Ошибка генерации документа → задача на повторную обработку (3.16 «Ручной режим»)
    if (active && o.id.length % 11 === 0) {
      push({
        at: o.updatedAt,
        event: "Ошибка генерации документа",
        action: "Перевод в ручной режим · создана задача на повторную обработку",
        result: "error",
        durationMs: fakeDuration(o.id + "e"),
        source: "Business Event Engine",
        orderNumber: o.orderNumber,
      });
    }
  }

  // Несколько системных событий периода (детерминированные)
  push({
    at: new Date(now - 6 * 3600000).toISOString(),
    event: "Синхронизация с поставщиками",
    action: "Обновлены тарифы 3 партнёров, проверена доступность API",
    result: "success",
    durationMs: fakeDuration("sync1"),
    source: "Business Event Engine",
  });
  push({
    at: new Date(now - 26 * 3600000).toISOString(),
    event: "Интеграция с платёжным шлюзом",
    action: "Повторная попытка оплаты после ошибки банка",
    result: "skipped",
    durationMs: fakeDuration("pay1"),
    source: "Business Event Engine",
  });
  push({
    at: new Date(now - 50 * 3600000).toISOString(),
    event: "AI-анализ портфеля заказов",
    action: "Выявлен риск отмены по 2 заказам — рекомендации переданы менеджерам",
    result: "success",
    durationMs: fakeDuration("ai1"),
    source: "AI Center",
  });

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

/** Сводная статистика журнала автоматизации (Гл. 3.16 «Мониторинг»). */
export function automationStats(events: AutomationEvent[]) {
  const total = events.length;
  const success = events.filter((e) => e.result === "success").length;
  const errors = events.filter((e) => e.result === "error").length;
  const skipped = events.filter((e) => e.result === "skipped").length;
  const avgMs = total ? Math.round(events.reduce((a, e) => a + e.durationMs, 0) / total) : 0;
  return { total, success, errors, skipped, avgMs };
}

// ── Исключительные ситуации (Гл. 3.17) ──

/**
 * Построение реестра активных исключений по заказам периода.
 * Обнаружение → классификация по категории → оценка критичности →
 * статус обработки → AI-рекомендация по устранению.
 */
export function buildExceptions(orders: OrderLike[]): SalesException[] {
  const list: SalesException[] = [];
  const now = Date.now();
  let seq = 0;
  const push = (e: Omit<SalesException, "id">) => {
    list.push({ id: `exc-${seq++}`, ...e });
  };

  for (const o of orders.slice(0, 60)) {
    const createdAt = new Date(o.createdAt).getTime();
    const hours = Math.round((now - createdAt) / 3600000);

    // Нарушение SLA (3.17 «Нарушение SLA»): критическое → эскалация
    if (o.status === "OVERDUE") {
      push({
        type: "Нарушение SLA",
        category: "Нарушения SLA",
        criticality: "critical",
        orderNumber: o.orderNumber,
        orderId: o.id,
        manager: o.manager,
        createdAt: o.updatedAt,
        status: "new",
        description: `Срок обработки превышен (${Math.max(hours, 1)} ч). Требуется немедленное действие и эскалация руководителю.`,
        aiSuggestion: "Повысить приоритет до «Срочный», уведомить руководителя подразделения и запросить подтверждение у поставщика.",
      });
    }

    // Ошибка взаимодействия с поставщиками (3.17): долгое ожидание подтверждения
    if (o.status === "AWAITING_CONFIRMATION" && hours > 24) {
      push({
        type: "Нет ответа поставщика",
        category: "Ошибки взаимодействия с поставщиками",
        criticality: "high",
        orderNumber: o.orderNumber,
        orderId: o.id,
        manager: o.manager,
        createdAt: o.updatedAt,
        status: "working",
        description: `Поставщик не подтвердил бронь за ${hours} ч. Возможен срыв сроков.`,
        aiSuggestion: "Предложить альтернативного поставщика или выполнить повторную попытку бронирования с повышением приоритета.",
      });
    }

    // Ошибка оплаты (3.17): долгое ожидание платежа
    if (o.status === "AWAITING_PAYMENT" && hours > 24) {
      push({
        type: "Задержка оплаты",
        category: "Ошибки оплаты",
        criticality: "medium",
        orderNumber: o.orderNumber,
        orderId: o.id,
        manager: o.manager,
        createdAt: o.updatedAt,
        status: "new",
        description: `Счёт не оплачен клиентом за ${hours} ч. Срок действия ссылки на оплату может истечь.`,
        aiSuggestion: "Создать новую ссылку на оплату и напомнить клиенту; при отказе банка — предложить альтернативный способ оплаты.",
      });
    }

    // Ошибка бронирования (3.17): возврат/отмена
    if (o.status === "REFUNDED" || o.status === "CANCELLED") {
      push({
        type: "Отмена / возврат",
        category: "Ошибки бронирования",
        criticality: "low",
        orderNumber: o.orderNumber,
        orderId: o.id,
        manager: o.manager,
        createdAt: o.updatedAt,
        status: "closed",
        description: `Заказ ${o.status === "REFUNDED" ? "возвращён" : "отменён"}. Возврат средств ${o.status === "REFUNDED" ? "оформлен" : "не требуется"}.`,
        aiSuggestion: "Проанализировать причину отмены и предложить клиенту альтернативное предложение для удержания.",
      });
    }
  }

  // Системные исключения (детерминированные): интеграция и конфликт данных (3.17)
  push({
    type: "Интеграция недоступна",
    category: "Ошибки интеграции",
    criticality: "high",
    orderNumber: "SYS-INT",
    orderId: "",
    manager: "Системный администратор",
    createdAt: new Date(now - 2 * 3600000).toISOString(),
    status: "working",
    description: "API платёжного шлюза недоступен — повторные попытки автоматически поставлены в очередь.",
    aiSuggestion: "Переключиться на резервный платёжный провайдер или продолжить попытки с экспоненциальной задержкой.",
  });
  push({
    type: "Конфликт изменений",
    category: "Конфликт данных",
    criticality: "medium",
    orderNumber: "SYS-CONF",
    orderId: "",
    manager: pickManager("sys-conf"),
    createdAt: new Date(now - 9 * 3600000).toISOString(),
    status: "resolved",
    description: "Два сотрудника одновременно редактировали заказ. Изменения объединены без потери данных.",
    aiSuggestion: "Включить блокировку редактирования заказа вторым пользователем при активной сессии.",
  });

  const rank: Record<Criticality, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusRank: Record<ExceptionStatus, number> = { new: 0, working: 1, resolved: 2, closed: 3 };
  return list.sort(
    (a, b) => rank[a.criticality] - rank[b.criticality] || statusRank[a.status] - statusRank[b.status] || b.createdAt.localeCompare(a.createdAt)
  );
}

/** Сводка панели исключений (Гл. 3.17). */
export function exceptionStats(list: SalesException[]) {
  const active = list.filter((e) => e.status === "new" || e.status === "working").length;
  const critical = list.filter((e) => e.criticality === "critical" && e.status !== "closed").length;
  const inWork = list.filter((e) => e.status === "working").length;
  const resolved = list.filter((e) => e.status === "resolved" || e.status === "closed").length;
  return { total: list.length, active, critical, inWork, resolved };
}
