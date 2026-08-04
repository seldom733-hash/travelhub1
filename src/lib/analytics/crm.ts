import { prisma } from "@/lib/prisma";
import { changePct, bucketize } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/**
 * 2.14 CRM-аналитика (Клиенты).
 * KPI (2.14.4), рост базы (2.14.5), RFM (2.14.7), LTV (2.14.8),
 * география (2.14.9), реестр (2.14.11), AI (2.14.12).
 */
export async function getCrmData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);

  // ── KPI клиентской базы ──
  const [totalBuyers, newBuyers, prevNewBuyers, activeBuyers, buyersWithOrders] = await Promise.all([
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.user.count({ where: { role: "BUYER", createdAt: { gte: range.start, lte: range.end } } }),
    prisma.user.count({ where: { role: "BUYER", createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
    prisma.user.count({ where: { role: "BUYER", orders: { some: { createdAt: { gte: range.start, lte: range.end } } } } }),
    prisma.user.count({ where: { role: "BUYER", orders: { some: {} } } }),
  ]);

  // Повторные покупатели (2+ заказа)
  const repeatBuyerIds = await prisma.order.groupBy({ by: ["userId"], _count: { _all: true } });
  const repeatBuyers = repeatBuyerIds.filter((r) => r._count._all >= 2).length;
  const repeatPct = buyersWithOrders ? (repeatBuyers / buyersWithOrders) * 100 : 0;

  // Активные за период, VIP (по сумме покупок)
  const orderUsers = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: { in: [...PAID] } },
    _sum: { paidAmount: true },
    _count: { _all: true },
  });
  const vipUsers = orderUsers.filter((r) => (r._sum.paidAmount ?? 0) >= 1500).length;
  const avgOrdersPerUser = orderUsers.length ? orderUsers.reduce((a, r) => a + r._count._all, 0) / orderUsers.length : 0;

  // LTV
  const totalRevenue = orderUsers.reduce((a, r) => a + (r._sum.paidAmount ?? 0), 0);
  const ltv = buyersWithOrders ? totalRevenue / buyersWithOrders : 0;
  const avgCheck = orderUsers.length ? totalRevenue / orderUsers.reduce((a, r) => a + r._count._all, 0) : 0;

  // Retention / Churn (оценка)
  const retention = activeBuyers ? Math.round((activeBuyers / Math.max(1, buyersWithOrders)) * 100) : 0;
  const churn = 100 - retention;

  // ── Рост базы (2.14.5) ──
  const userRows = await prisma.user.findMany({ where: { role: "BUYER", createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } });
  const growthSeries = bucketize(userRows.map((r) => ({ at: r.createdAt, amount: 1 })), f.period, range);

  // ── RFM-сегментация (2.14.7) ──
  const rfmRows = await prisma.user.findMany({
    where: { role: "BUYER" },
    select: {
      id: true,
      createdAt: true,
      orders: { select: { paidAmount: true, createdAt: true, status: true } },
    },
  });
  const rfm = { vip: 0, regular: 0, loyal: 0, new: 0, promising: 0, sleeping: 0, atRisk: 0, lost: 0 };
  for (const u of rfmRows) {
    const paid = u.orders.filter((o) => (PAID as readonly string[]).includes(o.status));
    const monetary = paid.reduce((a, o) => a + (o.paidAmount ?? 0), 0);
    const freq = paid.length;
    const last = paid.length ? Math.max(...paid.map((o) => o.createdAt.getTime())) : 0;
    const days = (Date.now() - last) / 86400000;
    if (freq >= 3 && monetary >= 800 && days <= 90) rfm.vip++;
    else if (freq >= 2 && days <= 180) rfm.regular++;
    else if (freq >= 1 && days <= 365) rfm.loyal++;
    else if (freq === 0 && days === Infinity && u.orders.length === 0) rfm.new++;
    else if (freq === 0 && days <= 30) rfm.new++;
    else if (days <= 30) rfm.promising++;
    else if (days <= 365) rfm.sleeping++;
    else if (days > 365) rfm.lost++;
    else rfm.atRisk++;
  }
  const rfmBar = {
    key: "rfm",
    title: "RFM-сегменты",
    icon: "🎯",
    rows: [
      { label: "VIP", value: rfm.vip, sub: "частые, крупные, недавние покупки" },
      { label: "Постоянные", value: rfm.regular, sub: "2+ покупки за полгода" },
      { label: "Лояльные", value: rfm.loyal, sub: "покупка за год" },
      { label: "Новые", value: rfm.new, sub: "только зарегистрировались" },
      { label: "Перспективные", value: rfm.promising, sub: "активны, без покупок" },
      { label: "Спящие", value: rfm.sleeping, sub: "не покупали 3–12 мес" },
      { label: "На грани ухода", value: rfm.atRisk, sub: "требуют внимания" },
      { label: "Потерянные", value: rfm.lost, sub: "более года без покупок" },
    ],
  };

  // ── LTV / повторные (2.14.8) ──
  const ltvBar = {
    key: "ltv",
    title: "Распределение клиентов по LTV",
    icon: "💎",
    rows: [
      { label: "до 300 $", value: orderUsers.filter((r) => (r._sum.paidAmount ?? 0) < 300).length },
      { label: "300–800 $", value: orderUsers.filter((r) => (r._sum.paidAmount ?? 0) >= 300 && (r._sum.paidAmount ?? 0) < 800).length },
      { label: "800–1500 $", value: orderUsers.filter((r) => (r._sum.paidAmount ?? 0) >= 800 && (r._sum.paidAmount ?? 0) < 1500).length },
      { label: "более 1500 $", value: orderUsers.filter((r) => (r._sum.paidAmount ?? 0) >= 1500).length },
    ],
  };

  // ── География клиентов (2.14.9) ──
  const geoUsers = await prisma.user.findMany({
    where: { role: "BUYER" },
    select: { id: true, orders: { select: { bookings: { select: { service: { select: { country: true, countryCode: true } } } } } } },
  });
  const geoMap = new Map<string, number>();
  for (const u of geoUsers) {
    const country = u.orders[0]?.bookings[0]?.service.country ?? "Не указано";
    geoMap.set(country, (geoMap.get(country) ?? 0) + 1);
  }
  const geoBar = {
    key: "geo",
    title: "Клиенты по странам",
    icon: "🌍",
    rows: [...geoMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8),
  };

  // ── Реестр клиентов (2.14.11) ──
  const clientTable = {
    key: "clientsTable",
    title: "Реестр клиентов",
    icon: "👥",
    columns: [
      { key: "name", label: "Клиент" },
      { key: "email", label: "Email" },
      { key: "orders", label: "Заказы", align: "right" },
      { key: "spent", label: "Покупки", align: "right" },
      { key: "ltv", label: "LTV", align: "right" },
      { key: "created", label: "Регистрация" },
    ],
    rows: rfmRows
      .map((u) => {
        const paid = u.orders.filter((o) => (PAID as readonly string[]).includes(o.status));
        const spent = paid.reduce((a, o) => a + (o.paidAmount ?? 0), 0);
        return {
          name: u.id,
          email: u.id,
          orders: paid.length,
          spent: Math.round(spent),
          ltv: Math.round(spent),
          created: u.createdAt.toLocaleDateString("ru-RU"),
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 20)
      .map((r, i) => ({ ...r, name: `Клиент #${(i + 1).toString().padStart(3, "0")}` })),
  };

  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  ai.push({ level: "info", title: `Клиентская база: ${totalBuyers}`, detail: `+${newBuyers} за период` });
  if (vipUsers > 0) ai.push({ level: "positive", title: `${vipUsers} VIP-клиентов`, detail: "покупки от 1500 $ — персональный сервис" });
  ai.push({ level: "info", title: `Средний LTV: ${Math.round(ltv)} $`, detail: `повторные покупки: ${repeatPct.toFixed(0)}%` });
  if (rfm.atRisk + rfm.sleeping > 0) ai.push({ level: "medium", title: `${rfm.atRisk + rfm.sleeping} клиентов в зоне риска`, detail: "рекомендуются реактивационные кампании" });

  return {
    section: "crm",
    title: "CRM-аналитика",
    subtitle: "Клиентская база и поведение (Гл. 2.14)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "total", title: "Всего клиентов", value: totalBuyers, tone: "neutral" },
      { key: "new", title: "Новые клиенты", value: newBuyers, change: changePct(newBuyers, prevNewBuyers), spark: growthSeries.values, tone: "neutral" },
      { key: "active", title: "Активные (покупки)", value: activeBuyers, tone: "positive" },
      { key: "repeat", title: "Повторные клиенты", value: repeatPct, unit: "%", tone: repeatPct >= 30 ? "positive" : "neutral" },
      { key: "vip", title: "VIP-клиенты", value: vipUsers, tone: "positive" },
      { key: "ltv", title: "Средний LTV", value: Math.round(ltv) },
      { key: "avgCheck", title: "Средний чек", value: Math.round(avgCheck) },
      { key: "ordersPerUser", title: "Покупок на клиента", value: Math.round(avgOrdersPerUser * 10) / 10, tone: "neutral" },
      { key: "retention", title: "Retention", value: retention, unit: "%", tone: retention >= 50 ? "positive" : "neutral" },
      { key: "churn", title: "Churn", value: churn, unit: "%", tone: churn <= 50 ? "positive" : "negative" },
    ],
    funnels: [],
    series: [
      { key: "growth", title: "Рост клиентской базы", icon: "📈", mode: "bar", data: growthSeries },
    ],
    donuts: [],
    barLists: [rfmBar, ltvBar, geoBar],
    tables: [clientTable],
    ai,
  };
}
