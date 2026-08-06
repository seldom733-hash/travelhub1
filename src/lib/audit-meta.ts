/**
 * Константы журнала аудита (Гл. 3.18) — без зависимостей от Prisma,
 * безопасны для импорта в клиентские компоненты.
 */

// ── Категории событий (Гл. 3.18 «Категории событий») ──

export const AUDIT_CATEGORIES = [
  "Пользовательские действия",
  "Финансовые операции",
  "Документооборот",
  "Безопасность",
  "Интеграции",
  "AI-события",
] as const;

export const AUDIT_CATEGORY_ICONS: Record<string, string> = {
  "Пользовательские действия": "👤",
  "Финансовые операции": "💰",
  "Документооборот": "📄",
  "Безопасность": "🛡",
  "Интеграции": "🔗",
  "AI-события": "🤖",
};

// ── Типы действий (Гл. 3.18 «События, подлежащие регистрации») ──

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "Вход в систему",
  login_failed: "Неудачная попытка входа",
  logout: "Выход из системы",
  create: "Создание объекта",
  update: "Изменение данных",
  delete: "Удаление информации",
  status: "Изменение статуса",
  payment: "Финансовая операция",
  refund: "Возврат средств",
  document: "Документооборот",
  bulk: "Массовая операция",
  api: "Обращение к API",
  ai: "AI-анализ / рекомендация",
  security: "Событие безопасности",
  integration: "Интеграция",
};

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS);

// ── Критичность ──

export const AUDIT_CRITICALITY: { key: string; label: string; color: string }[] = [
  { key: "info", label: "Информация", color: "#3b82f6" },
  { key: "warning", label: "Внимание", color: "#f59e0b" },
  { key: "error", label: "Ошибка", color: "#f97316" },
  { key: "critical", label: "Критический", color: "#dc2626" },
];

export function auditCriticalityColor(key: string): string {
  return AUDIT_CRITICALITY.find((c) => c.key === key)?.color ?? "#3b82f6";
}

// ── Источники событий ──

export const AUDIT_SOURCES = ["Web", "API", "Mobile", "AI", "Integration", "System"] as const;
