import { prisma } from "@/lib/prisma";

/**
 * Непрочитанные сообщения менеджера/системы по заказам — данные виджета
 * «Сообщения» (Гл. 1.24). Используется и полной загрузкой дашборда
 * (/api/admin/dashboard), и лёгким эндпоинтом фонового обновления счётчика
 * (/api/admin/dashboard/messages), чтобы оба отдавали идентичную структуру.
 */
export async function getDashboardMessages() {
  const [unread, recent] = await Promise.all([
    prisma.orderMessage.count({ where: { isRead: false, senderRole: { in: ["manager", "system"] } } }),
    prisma.orderMessage.findMany({
      where: { isRead: false, senderRole: { in: ["manager", "system"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        senderName: true,
        text: true,
        createdAt: true,
        order: { select: { orderNumber: true, id: true } },
      },
    }),
  ]);
  return {
    unread,
    // Каждое сообщение ведёт на карточку заказа с открытой вкладкой «Коммуникации»
    items: recent.map((m) => ({
      id: m.id,
      senderName: m.senderName,
      text: m.text,
      createdAt: m.createdAt,
      order: { id: m.order.id, orderNumber: m.order.orderNumber },
      href: `/admin/orders?open=${m.order.id}&tab=messages`,
    })),
  };
}
