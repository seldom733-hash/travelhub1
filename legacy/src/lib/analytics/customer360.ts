import { prisma } from "@/lib/prisma";

/**
 * Customer 360° (Гл. 2.14.13): полный профиль клиента в одном месте —
 * история заказов, бронирования, платежи, возвраты, сообщения, отзывы,
 * любимые направления и AI-профиль (вероятность следующей покупки).
 */

const PAID: ("FULFILLED" | "READY_TO_CLOSE" | "CLOSED")[] = ["FULFILLED", "READY_TO_CLOSE", "CLOSED"];

export interface Customer360Data {
  name: string;
  email: string;
  country: string;
  city: string;
  registeredAt: string;
  // Финансы
  totalOrders: number;
  totalSpent: number;
  avgCheck: number;
  refunds: number;
  // Активность
  lastOrderAt: string | null;
  reviewsCount: number;
  unreadMessages: number;
  favorites: { label: string; value: number }[];
  // История заказов
  orders: { id: string; number: string; amount: number; status: string; at: string }[];
  // AI-профиль
  aiNextPurchase: number; // вероятность 0–100
  aiNote: string;
  recommended: string[];
}

export async function getCustomer360Data(userId: string): Promise<Customer360Data | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          amount: true,
          paidAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          bookings: { select: { service: { select: { type: true, country: true, city: true, title: true } } } },
        },
      },
      reviews: { select: { id: true, rating: true, createdAt: true } },
    },
  });
  if (!user) return null;

  const paidOrders = user.orders.filter((o) => (PAID as readonly string[]).includes(o.status));
  const totalSpent = paidOrders.reduce((a, o) => a + (o.paidAmount ?? 0), 0);
  const refunds = user.orders.filter((o) => o.paymentStatus === "REFUNDED").length;
  const avgCheck = paidOrders.length ? totalSpent / paidOrders.length : 0;

  const favMap = new Map<string, number>();
  for (const o of user.orders) {
    for (const b of o.bookings) {
      const s = b.service;
      const key = s.country && s.city ? `${s.country} · ${s.city}` : s.country ?? "Прочее";
      favMap.set(key, (favMap.get(key) ?? 0) + 1);
    }
  }
  const favorites = [...favMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const unreadMessages = await prisma.orderMessage.count({
    where: { order: { userId }, isRead: false, senderRole: { in: ["client", "system"] } },
  });
  const lastOrder = user.orders[0];
  const daysSinceLast = lastOrder ? Math.max(0, Math.round((Date.now() - lastOrder.createdAt.getTime()) / 86400000)) : null;
  const freq = paidOrders.length;
  // AI-профиль: вероятность следующей покупки (0–100)
  const aiNextPurchase = Math.max(5, Math.min(95, Math.round(freq * 18 + (daysSinceLast !== null && daysSinceLast <= 60 ? 25 : 5) + (totalSpent >= 1500 ? 15 : 0))));
  const aiNote =
    freq >= 3
      ? `Постоянный клиент (${freq} покупок). Рекомендуется программа лояльности и персональные предложения.`
      : daysSinceLast !== null && daysSinceLast <= 90
        ? `Активный клиент, последняя покупка ${daysSinceLast} дн. назад. Кросс-продажи смежных услуг.`
        : freq === 0
          ? "Клиент без покупок — рекомендуется приветственная серия предложений."
          : "Снижение активности — реактивационная кампания через 14 дней после поездки.";

  const typeMap = new Map<string, number>();
  for (const o of user.orders) {
    for (const b of o.bookings) typeMap.set(b.service.type, (typeMap.get(b.service.type) ?? 0) + 1);
  }
  const topType = [...typeMap.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 3);
  const recommended = topType.length ? topType : ["TOUR", "HOTEL", "TRANSFER"];

  return {
    name: `${user.firstName} ${user.lastName ?? ""}`.trim(),
    email: user.email,
    country: "—",
    city: "—",
    registeredAt: user.createdAt.toLocaleDateString("ru-RU"),
    totalOrders: user.orders.length,
    totalSpent: Math.round(totalSpent),
    avgCheck: Math.round(avgCheck),
    refunds,
    lastOrderAt: lastOrder ? lastOrder.createdAt.toLocaleDateString("ru-RU") : null,
    reviewsCount: user.reviews.length,
    unreadMessages,
    favorites,
    orders: user.orders.slice(0, 10).map((o) => ({
      id: o.id,
      number: o.orderNumber,
      amount: o.amount,
      status: o.status,
      at: o.createdAt.toLocaleDateString("ru-RU"),
    })),
    aiNextPurchase,
    aiNote,
    recommended,
  };
}
