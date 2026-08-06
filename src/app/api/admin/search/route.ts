import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { ALL_ADMIN_ROLES, FULL_ADMIN_ROLES, SALES_ROLES, EXECUTION_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/** Число результатов на группу. */
const LIMIT = 6;

/**
 * GET /api/admin/search?q=…
 * Глобальный поиск (Гл. 1.5): ищет одновременно по заказам, клиентам/партнёрам
 * (пользователям), услугам и бронированиям. Результаты сгруппированы по типу
 * сущности, каждый пункт ведёт на объект (карточка заказа, профиль пользователя,
 * услуга, бронирование).
 *
 * Примечание: провайдер SQLite не поддерживает mode: "insensitive" (поиск
 * регистронезависим только для ASCII), поэтому используем обычный contains.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, ALL_ADMIN_ROLES);
    if (denied) return denied;

    // Ограниченным ролям показываем в поиске только их разделы (Гл. 1.2):
    // SALES_MANAGER — заказы, OPERATOR — бронирования. Полные роли видят всё.
    // Единый источник прав — константы из admin-access.ts (чтобы не расходиться
    // с гвардами API при изменении состава ролей).
    const canOrders = (SALES_ROLES as readonly string[]).includes(user.role);
    const canBookings = (EXECUTION_ROLES as readonly string[]).includes(user.role);
    // Пользователи и услуги ведут в разделы «Пользователи»/«Каталог» (полные роли);
    // для ограниченных ролей ссылки на запрещённые разделы скрываем.
    const canUsersServices = (FULL_ADMIN_ROLES as readonly string[]).includes(user.role);

    const q = (new URL(request.url).searchParams.get("q") || "").trim();

    // Специальный режим: scope=partners возвращает список партнёров для фильтра
    // в аналитике (Гл. 2.7) без требования к длине запроса.
    const scope = new URL(request.url).searchParams.get("scope") || "";
    if (scope === "partners") {
      const partnerUsers = await prisma.user.findMany({
        where: { role: "PARTNER" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, firstName: true, lastName: true, companyName: true },
      });
      return NextResponse.json({
        query: q,
        partners: partnerUsers.map((u) => ({
          id: u.id,
          name: u.companyName || `${u.firstName} ${u.lastName ?? ""}`.trim(),
        })),
      });
    }
    // scope=clients возвращает покупателей для Customer 360° (Гл. 2.14.13)
    if (scope === "clients") {
      const clientUsers = await prisma.user.findMany({
        where: { role: "BUYER", orders: { some: {} } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      return NextResponse.json({
        query: q,
        clients: clientUsers.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName ?? ""}`.trim() || u.email,
        })),
      });
    }

    if (q.length < 2) {
      return NextResponse.json({ query: q, orders: [], users: [], services: [], bookings: [], documents: [] });
    }

    const contains = { contains: q };

    const [orders, users, services, bookings, documents] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: contains },
            { user: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          amount: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.user.findMany({
        where: {
          OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { companyName: contains }],
        },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          companyName: true,
        },
      }),
      prisma.service.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { city: contains }, { country: contains }] },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: {
          id: true,
          title: true,
          type: true,
          price: true,
          currency: true,
          discountPrice: true,
          country: true,
        },
      }),
      prisma.booking.findMany({
        where: {
          OR: [
            { user: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] } },
            { service: { OR: [{ title: contains }, { city: contains }, { country: contains }] } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: {
          id: true,
          status: true,
          amount: true,
          orderId: true,
          service: { select: { title: true, type: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      // Документы (Гл. 1.5): события документооборота из журнала аудита —
      // ваучеры, авиабилеты, договоры. Раздел «Документы» — заглушка, поэтому
      // реальные записи о документах берём из категории «Документооборот».
      prisma.auditLog.findMany({
        where: {
          category: "Документооборот",
          OR: [{ comment: contains }, { objectNumber: contains }, { objectType: contains }, { actorName: contains }],
        },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: { id: true, eventId: true, comment: true, objectNumber: true, objectType: true, actorName: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      query: q,
      orders: canOrders ? orders.map((o) => ({
        id: o.id,
        label: `Заказ №${o.orderNumber}`,
        detail: `${o.user.firstName} ${o.user.lastName ?? ""}`.trim() || "—",
        status: o.status,
        amount: o.amount,
        href: `/admin/sales-execution?open=${o.id}&tab=overview`,
      })) : [],
      users: canUsersServices ? users.map((u) => ({
        id: u.id,
        label: `${u.firstName} ${u.lastName ?? ""}`.trim() || u.email,
        detail: u.email,
        role: u.role,
        companyName: u.companyName,
        href: "/admin/users",
      })) : [],
      services: canUsersServices ? services.map((s) => ({
        id: s.id,
        label: s.title,
        detail: s.country ? `${s.country}` : s.type,
        price: s.discountPrice ?? s.price,
        currency: s.currency,
        href: "/admin/catalog",
      })) : [],
      bookings: canBookings ? bookings.map((b) => ({
        id: b.id,
        label: b.service.title || `Бронь ${b.id.slice(0, 6)}`,
        detail: `${b.user.firstName} ${b.user.lastName ?? ""}`.trim() || "—",
        status: b.status,
        amount: b.amount,
        href: b.orderId ? `/admin/sales-execution?open=${b.orderId}&tab=overview` : "/admin/bookings",
      })) : [],
      documents: canUsersServices
        ? documents.map((d) => ({
            id: d.id,
            label: d.objectNumber ? `Документ ${d.objectNumber}` : `Документ ${d.eventId}`,
            detail: `${d.objectType ?? "Документ"} · ${d.comment ?? ""}`.slice(0, 90),
            actor: d.actorName,
            href: "/admin/documents",
          }))
        : [],
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin search API error");
  }
}
