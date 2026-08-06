import { prisma } from "@/lib/prisma";
import { SERVICE_TYPE_LABELS } from "@/lib/admin-data";

/**
 * Partner 360° (Гл. 2.15.13): аналитическая карточка партнёра —
 * общие сведения, финансовый профиль, операционные показатели,
 * история взаимодействия и AI-профиль.
 */

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

export interface Partner360Data {
  name: string;
  contact: string;
  category: string;
  country: string;
  city: string;
  connectedAt: string;
  status: string;
  // Финансовый профиль
  turnover: number;
  profit: number;
  orders: number;
  avgCheck: number;
  refunds: number;
  // Операционные показатели
  confirmPct: number;
  cancelPct: number;
  sla: number;
  rating: number;
  responseScore: number;
  // История
  historyEvents: { at: string; action: string; detail: string }[];
  // AI-профиль
  reliabilityForecast: number; // 0–100
  growthForecast: number;
  aiNote: string;
}

export async function getPartner360Data(partnerId: string): Promise<Partner360Data | null> {
  const partner = await prisma.user.findUnique({
    where: { id: partnerId },
    select: {
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      createdAt: true,
      isActive: true,
      services: {
        select: {
          type: true,
          country: true,
          city: true,
          rating: true,
          reviewCount: true,
          bookings: {
            select: { id: true, status: true, amount: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!partner) return null;

  const bookings = partner.services.flatMap((s) => s.bookings);
  const total = bookings.length;
  const confirmed = bookings.filter((b) => ["CONFIRMED", "PAID", "COMPLETED"].includes(b.status)).length;
  const cancelled = bookings.filter((b) => b.status === "REFUNDED").length;
  const revenue = bookings.filter((b) => PAID.includes(b.status as (typeof PAID)[number])).reduce((a, b) => a + b.amount, 0);
  const confirmPct = total ? Math.round((confirmed / total) * 100) : 0;
  const cancelPct = total ? Math.round((cancelled / total) * 100) : 0;
  const avgRating = partner.services.length
    ? Math.round((partner.services.reduce((a, s) => a + s.rating, 0) / partner.services.length) * 10) / 10
    : 0;
  const topService = partner.services.reduce<typeof partner.services[number] | undefined>(
    (best, s) => (!best || s.bookings.length > best.bookings.length ? s : best),
    undefined
  );
  const sla = Math.max(0, 100 - cancelPct * 2);
  const responseScore = Math.max(40, Math.min(99, 100 - Math.round(total * 0.7)));

  // История взаимодействия (из журнала аудита и истории услуг)
  const [auditRows, historyRows] = await Promise.all([
    prisma.auditLog.findMany({
      where: { objectType: "Партнёр", objectId: partnerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, action: true, comment: true },
    }),
    prisma.serviceHistory.findMany({
      where: { service: { providerId: partnerId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, action: true, comment: true, service: { select: { title: true } } },
    }),
  ]);
  const historyEvents = [
    ...auditRows.map((h) => ({
      at: h.createdAt.toLocaleDateString("ru-RU"),
      action: h.action,
      detail: h.comment ?? "—",
    })),
    ...historyRows.map((h) => ({
      at: h.createdAt.toLocaleDateString("ru-RU"),
      action: `Услуга «${h.service.title}»`,
      detail: h.comment ?? h.action,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const reliabilityForecast = Math.max(10, Math.min(98, Math.round(confirmPct * 0.5 + (100 - cancelPct) * 0.3 + (total ? Math.min(20, total * 2) : 10))));
  const growthForecast = Math.max(5, Math.min(95, Math.round(total * 6 + (partner.services.length ? 20 : 0))));
  const aiNote =
    cancelPct > 25
      ? `Высокий процент отмен (${cancelPct}%) — провести переговоры и временно ограничить объём заказов.`
      : confirmPct >= 85
        ? `Надёжный поставщик (подтверждений ${confirmPct}%) — рекомендуется повысить рейтинг и увеличить поток бронирований.`
        : `Средний уровень надёжности — мониторить SLA и скорость ответа.`;

  return {
    name: partner.companyName || `${partner.firstName} ${partner.lastName ?? ""}`.trim(),
    contact: partner.email,
    category: topService ? SERVICE_TYPE_LABELS[topService.type] ?? topService.type : "—",
    country: topService?.country ?? "—",
    city: topService?.city ?? "—",
    connectedAt: partner.createdAt.toLocaleDateString("ru-RU"),
    status: partner.isActive ? "Активен" : "На модерации",
    turnover: Math.round(revenue),
    profit: Math.round(revenue * 0.12),
    orders: total,
    avgCheck: confirmed ? Math.round(revenue / confirmed) : 0,
    refunds: cancelled,
    confirmPct,
    cancelPct,
    sla,
    rating: avgRating,
    responseScore,
    historyEvents,
    reliabilityForecast,
    growthForecast,
    aiNote,
  };
}
