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

/** Возвращает пункт меню, соответствующий текущему пути (или дефолт). */
export function getAdminSection(pathname: string): AdminMenuItem {
  // Точное совпадение для корня админки
  if (pathname === "/admin") {
    return ADMIN_MENU[0];
  }
  // Префиксное совпадение + алиасы (вкладки раздела «Продажи и исполнение»)
  const match = ADMIN_MENU.find((item) => {
    if (item.href === "/admin") return false;
    if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
    return !!item.aliases?.some((a) => pathname === a || pathname.startsWith(a + "/"));
  });
  return match ?? ADMIN_MENU[0];
}
