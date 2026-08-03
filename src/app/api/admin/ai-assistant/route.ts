import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SERVICE_TYPE_LABELS, fmtMoney, seriesTrendPct, ORDER_STATUS_GROUPS } from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";

export const dynamic = "force-dynamic";

const PAID_STATUSES = [...ORDER_STATUS_GROUPS.paid] as const;

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * GET /api/admin/ai-assistant?q=…
 * Отвечает на типовые вопросы на естественном языке реальными данными из БД:
 * доход по месяцам, слабые/сильные категории, прогноз по тренду.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase();
    if (!q) {
      return NextResponse.json({
        answer: "Задайте вопрос на русском языке, например: «доход за 3 месяца».",
      });
    }

    // ── Прогноз: экстраполяция тренда оплаченных заказов текущего месяца ──
    if (q.includes("прогноз")) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const rows = await prisma.order.findMany({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: monthStart } },
        select: { createdAt: true, paidAmount: true },
      });
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const k = r.createdAt.toISOString().slice(0, 10);
        byDay.set(k, (byDay.get(k) ?? 0) + (r.paidAmount ?? 0));
      }
      const values: number[] = [];
      const now = new Date();
      for (let i = 30; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        values.push(Math.round(byDay.get(d.toISOString().slice(0, 10)) ?? 0));
      }
      const total = values.reduce((a, b) => a + b, 0);
      const trend = seriesTrendPct(values);
      const forecast = Math.round(total * (1 + trend / 100));
      const sign = trend >= 0 ? "+" : "";
      return NextResponse.json({
        answer: `Доход текущего месяца — ${fmtMoney(total)}. Тренд ${sign}${trend}%: прогноз на следующий период — около ${fmtMoney(forecast)}.`,
      });
    }

    // ── Доход за последние 3 месяца ──
    if (q.includes("доход") && (q.includes("месяц") || q.includes("3"))) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(1);
      start.setMonth(start.getMonth() - 2);
      const rows = await prisma.order.findMany({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: start } },
        select: { createdAt: true, paidAmount: true },
      });
      const byMonth = new Map<string, number>();
      for (const r of rows) {
        const k = monthKey(r.createdAt);
        byMonth.set(k, (byMonth.get(k) ?? 0) + (r.paidAmount ?? 0));
      }
      const months: string[] = [];
      const cur = new Date();
      for (let i = 2; i >= 0; i--) {
        const m = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
        months.push(`${m.toLocaleDateString("ru-RU", { month: "long" })} — ${fmtMoney(byMonth.get(monthKey(m)) ?? 0)}`);
      }
      return NextResponse.json({ answer: `Доход по месяцам: ${months.join("; ")}.` });
    }

    // ── Слабые / сильные категории текущего месяца ──
    if (q.includes("тур") || q.includes("прода") || q.includes("категор")) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const paid = await prisma.order.findMany({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: monthStart } },
        select: {
          id: true,
          paidAmount: true,
          bookings: { select: { service: { select: { type: true } } } },
        },
      });
      const agg: Record<string, number> = {};
      for (const o of paid) {
        const types = o.bookings.map((b) => b.service.type);
        const amount = (o.paidAmount ?? 0) / Math.max(1, types.length);
        for (const t of types) agg[t] = (agg[t] ?? 0) + amount;
      }
      const sorted = Object.entries(agg).sort((a, b) => a[1] - b[1]);
      if (!sorted.length) {
        return NextResponse.json({
          answer: "За текущий месяц оплаченных продаж ещё нет — данные появятся после первых оплат.",
        });
      }
      const worst = sorted.slice(0, 3).map(([t, v]) => `${SERVICE_TYPE_LABELS[t] ?? t} (${fmtMoney(v)})`);
      const [bestType, bestVal] = sorted[sorted.length - 1];
      return NextResponse.json({
        answer: `Слабые категории месяца: ${worst.join(", ")}. Лидер — ${SERVICE_TYPE_LABELS[bestType] ?? bestType} (${fmtMoney(bestVal)}).`,
      });
    }

    // ── Вопрос вне типовых сценариев ──
    return NextResponse.json({
      answer:
        "Пока я отвечаю на вопросы о доходах, продажах по категориям и прогнозах. Примеры: «доход за 3 месяца», «какие туры продаются хуже всего», «прогноз продаж».",
    });
  } catch (error) {
    return serverErrorResponse(error, "AI assistant API error");
  }
}
