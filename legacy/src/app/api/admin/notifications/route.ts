import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { fmtMoney } from "@/lib/admin-data";
import { DASHBOARD_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/notifications?category=all|urgent|finance|sales|execution|crm|system&limit=50
 * Центр уведомлений Dashboard (Гл. 1.43): единая лента событий с фильтрами по
 * категориям. Данные строятся из реальных записей БД — заказы, пользователи,
 * отзывы, исключения, журнал автоматизации, аудит.
 *
 * Категории фильтра соответствуют Гл. 1.43: Все · Срочные · Финансы · Продажи ·
 * Исполнение · CRM · Система. Каждое уведомление содержит тип, время, краткое
 * описание и ссылку на объект (Гл. 1.10).
 */

// Категории фильтра (ключ → подпись в интерфейсе)
export const NOTIFY_CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "urgent", label: "Срочные" },
  { key: "finance", label: "Финансы" },
  { key: "sales", label: "Продажи" },
  { key: "execution", label: "Исполнение" },
  { key: "crm", label: "CRM" },
  { key: "system", label: "Система" },
] as const;

export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number]["key"];

interface NotifyItem {
  id: string;
  type: string;
  category: NotifyCategory;
  title: string;
  detail: string;
  at: Date;
  href: string;
  criticality: "info" | "warning" | "critical";
}

/** Типы событий и их подписи для заказов. */
const ORDER_NOTIFY: Record<string, { type: string; title: string; category: NotifyCategory; criticality: NotifyItem["criticality"] }> = {
  CREATED: { type: "order", title: "Создан новый заказ", category: "sales", criticality: "info" },
  AWAITING_CONFIRMATION: { type: "confirm", title: "Ожидает подтверждения поставщика", category: "execution", criticality: "warning" },
  CONFIRMED: { type: "confirm", title: "Заказ подтверждён", category: "execution", criticality: "info" },
  AWAITING_PAYMENT: { type: "pay", title: "Ожидается оплата", category: "finance", criticality: "warning" },
  PARTIALLY_PAID: { type: "pay", title: "Частичная оплата по заказу", category: "finance", criticality: "warning" },
  PAID: { type: "paid", title: "Поступила полная оплата", category: "finance", criticality: "info" },
  DOCUMENT_PREP: { type: "doc", title: "Подготовка документов", category: "execution", criticality: "info" },
  READY: { type: "done", title: "Заказ готов к поездке", category: "execution", criticality: "info" },
  COMPLETED: { type: "done", title: "Заказ выполнен", category: "execution", criticality: "info" },
  REFUNDED: { type: "refund", title: "Оформлен возврат", category: "finance", criticality: "warning" },
  CANCELLED: { type: "cancel", title: "Заказ отменён", category: "sales", criticality: "warning" },
  OVERDUE: { type: "urgent", title: "Срок обработки превышен", category: "urgent", criticality: "critical" },
};

/** Тип исключения → категория центра уведомлений. */
const EXCEPTION_CATEGORY: Record<string, NotifyCategory> = {
  "Нарушения SLA": "urgent",
  "Ошибки оплаты": "finance",
  "Ошибки бронирования": "execution",
  "Ошибки взаимодействия с поставщиками": "execution",
  "Ошибки интеграции": "system",
  "Конфликт данных": "system",
};

const EXCEPTION_CRIT: Record<string, NotifyItem["criticality"]> = {
  critical: "critical",
  high: "warning",
  medium: "warning",
  low: "info",
};

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, DASHBOARD_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") || "all") as NotifyCategory;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    // ── Источники событий: заказы, пользователи, отзывы, исключения, автоматизация ──
    const [recentOrders, recentUsers, recentReviews, recentExceptions, recentAutomation] = await Promise.all([
      prisma.order.findMany({
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          amount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, firstName: true, lastName: true, role: true, createdAt: true },
      }),
      prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, rating: true, createdAt: true },
      }),
      prisma.exceptionLog.findMany({
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: { id: true, type: true, category: true, criticality: true, status: true, orderNumber: true, description: true, updatedAt: true },
      }),
      prisma.automationLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, event: true, action: true, result: true, createdAt: true },
      }),
    ]);

    const items: NotifyItem[] = [];

    // События заказов (каждое — отдельное уведомление с моментом изменения статуса).
    for (const o of recentOrders) {
      const meta = ORDER_NOTIFY[o.status];
      if (!meta) continue;
      items.push({
        id: `o-${o.id}`,
        type: meta.type,
        category: meta.category,
        title: `${meta.title} №${o.orderNumber}`,
        detail: o.amount ? fmtMoney(o.amount) : "Требует внимания",
        at: o.updatedAt,
        href: `/admin/sales-execution?open=${o.id}&tab=overview`,
        criticality: meta.criticality,
      });
    }

    // Новые пользователи и партнёры (CRM)
    for (const u of recentUsers) {
      const isPartner = u.role === "PARTNER";
      items.push({
        id: `u-${u.id}`,
        type: isPartner ? "partner" : "user",
        category: "crm",
        title: `Новый ${isPartner ? "партнёр" : "пользователь"}: ${u.firstName} ${u.lastName ?? ""}`.trim(),
        detail: isPartner ? "Требуется проверка документов" : "Регистрация на сайте",
        at: u.createdAt,
        href: "/admin/users",
        criticality: isPartner ? "warning" : "info",
      });
    }

    // Новые отзывы (CRM)
    for (const r of recentReviews) {
      items.push({
        id: `r-${r.id}`,
        type: "review",
        category: "crm",
        title: `Новый отзыв: ${r.rating}★`,
        detail: "Требуется модерация",
        at: r.createdAt,
        href: "/admin/content",
        criticality: "info",
      });
    }

    // Исключительные ситуации (Гл. 3.17) — Срочные / Исполнение / Финансы / Система
    for (const ex of recentExceptions) {
      const cat = EXCEPTION_CATEGORY[ex.category] ?? "system";
      const crit = EXCEPTION_CRIT[ex.criticality] ?? "info";
      items.push({
        id: `ex-${ex.id}`,
        type: ex.criticality === "critical" ? "urgent" : "exception",
        category: cat,
        title: ex.type,
        detail: ex.description.length > 110 ? ex.description.slice(0, 110) + "…" : ex.description,
        at: ex.updatedAt,
        href: "/admin/sales-execution?tab=exceptions",
        criticality: crit,
      });
    }

    // Журнал автоматизации (Гл. 3.16) — Система
    for (const a of recentAutomation) {
      items.push({
        id: `au-${a.id}`,
        type: a.result === "error" ? "urgent" : "automation",
        category: "system",
        title: a.event,
        detail: a.action,
        at: a.createdAt,
        href: "/admin/sales-execution?tab=automation",
        criticality: a.result === "error" ? "warning" : "info",
      });
    }

    // Сортировка по времени (новые сверху) и фильтр по категории
    const filtered = items
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .filter((n) => category === "all" || n.category === category)
      .slice(0, limit);

    // Количество непрочитанных по каждой категории — для бейджей в фильтрах.
    // «Непрочитанными» считаем события, которые ещё не открывали: вычисляется на
    // клиенте из истории прочтения (localStorage), здесь отдаём только общее число.
    const counts = NOTIFY_CATEGORIES.reduce(
      (acc, c) => {
        acc[c.key] = c.key === "all" ? items.length : items.filter((n) => n.category === c.key).length;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({ categories: NOTIFY_CATEGORIES, counts, items: filtered });
  } catch (error) {
    return serverErrorResponse(error, "Notifications API error");
  }
}
