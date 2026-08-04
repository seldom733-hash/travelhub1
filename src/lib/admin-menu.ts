/**
 * Общее меню административной панели (мастер-архитектура, «Архитектура проекта.docx»).
 * 16 разделов левой панели. Используется и в левом сайдбаре (AdminSidebar),
 * и в шапке (AdminHeader) для отображения названия активного раздела.
 */

export interface AdminMenuItem {
  icon: string;
  label: string;
  href: string;
  /** Дополнительные пути, которые считаются частью этого раздела (вкладки раздела). */
  aliases?: string[];
  /** Временно скрытые пункты (не показываются в сайдбаре, но путь остаётся рабочим). */
  hidden?: boolean;
}

export const ADMIN_MENU: AdminMenuItem[] = [
  { icon: "🏠", label: "Центр управления", href: "/admin" },
  { icon: "📊", label: "Аналитика", href: "/admin/analytics" },
  {
    icon: "🧳",
    label: "Продажи и исполнение",
    href: "/admin/orders",
    aliases: ["/admin/sales", "/admin/bookings"],
  },
  { icon: "📚", label: "Каталог услуг", href: "/admin/catalog" },
  { icon: "🤝", label: "CRM", href: "/admin/crm" },
  { icon: "💰", label: "Финансы", href: "/admin/finance" },
  { icon: "📢", label: "Маркетинг", href: "/admin/marketing" },
  { icon: "🎧", label: "Поддержка", href: "/admin/support" },
  { icon: "👥", label: "Пользователи", href: "/admin/users" },
  { icon: "📄", label: "Документы", href: "/admin/documents" },
  { icon: "📅", label: "Календарь", href: "/admin/calendar" },
  { icon: "📈", label: "Отчеты", href: "/admin/reports" },
  { icon: "🔗", label: "Интеграции", href: "/admin/integrations" },
  { icon: "🤖", label: "AI Center", href: "/admin/ai-center" },
  { icon: "🖥", label: "Система", href: "/admin/system" },
  { icon: "⚙", label: "Настройки", href: "/admin/settings" },
  // Скрытые разделы (не входят в 16 пунктов мастер-архитектуры, пути остаются рабочими):
  // Бронирования и Контент — по новой концепции это части других разделов.
  { icon: "📑", label: "Бронирования", href: "/admin/bookings", hidden: true },
  { icon: "📝", label: "Контент", href: "/admin/content", hidden: true },
];

/**
 * Доступ ролей к разделам админки (Гл. 1.2): менеджер по продажам — Dashboard
 * и «Продажи» (заказы, продажи); операционист — Dashboard и «Исполнение»
 * (бронирования). Роли без записи (ADMIN, MODERATOR, PARTNER и пр.) — полный доступ.
 * Путь разрешён, если совпадает с префиксом раздела (сам раздел или его вкладка).
 */
export const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  SALES_MANAGER: ["/admin", "/admin/orders", "/admin/sales"],
  OPERATOR: ["/admin", "/admin/bookings"],
};

/** Может ли роль открыть указанный путь админки (сам путь или вкладка). */
export function canAccessAdminPath(pathname: string, role: string): boolean {
  const prefixes = ROLE_ALLOWED_PREFIXES[role];
  if (!prefixes) return true;
  return prefixes.some((p) => {
    // Корневой Dashboard «/admin» — только сам корень (не все /admin/*).
    if (p === "/admin") return pathname === "/admin";
    return pathname === p || pathname.startsWith(p + "/");
  });
}

/**
 * Пункты меню для роли (сайдбар и шапка). Ограниченные роли видят только свои
 * разделы: SALES_MANAGER — «Продажи», OPERATOR — «Исполнение» (бронирования).
 */
export function menuForRole(role: string): AdminMenuItem[] {
  const full = ADMIN_MENU.filter((i) => !i.hidden);
  if (role === "SALES_MANAGER") {
    return full
      .filter((i) => i.href === "/admin" || i.href === "/admin/orders")
      .map((i) => (i.href === "/admin/orders" ? { ...i, label: "Продажи" } : i));
  }
  if (role === "OPERATOR") {
    const dashboard = full.find((i) => i.href === "/admin")!;
    const bookings = ADMIN_MENU.find((i) => i.href === "/admin/bookings")!;
    return [dashboard, { ...bookings, label: "Исполнение", hidden: false }];
  }
  return full;
}

/** Возвращает пункт меню, соответствующий текущему пути (или дефолт). */
export function getAdminSection(pathname: string, role?: string): AdminMenuItem {
  // Меню, из которого ищем раздел: для ограниченных ролей — их собственное меню,
  // чтобы хлебные крошки и заголовок показывали корректный раздел.
  const source = role ? menuForRole(role) : ADMIN_MENU;
  // Точное совпадение для корня админки
  if (pathname === "/admin") {
    return source[0];
  }
  // Префиксное совпадение + алиасы (вкладки раздела «Продажи и исполнение»)
  const match = source.find((item) => {
    if (item.href === "/admin") return false;
    if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
    return !!item.aliases?.some((a) => pathname === a || pathname.startsWith(a + "/"));
  });
  return match ?? source[0];
}
