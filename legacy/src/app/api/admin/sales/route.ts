import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";
import { nextBusinessCode } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * Sales Center (Phase 2, Baseline §0.7).
 *
 * GET /api/admin/sales — реестр Lead/Opportunity/Quote/Sale с KPI-панелью:
 *   new leads, active opportunities, quotes pending, sales, conversion,
 *   average check, forecast, overdue next actions.
 *
 * POST /api/admin/sales — создание:
 *   { entity: "lead", ... }          → LED-*
 *   { entity: "opportunity", ... }   → OPP-* (обычно из квалифицированного лида)
 *   { entity: "quote", ... }         → QTE-* из opportunity (items: serviceId, qty)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    const [leads, opportunities, quotes, sales, quotesPending] = await Promise.all([
      prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, code: true, source: true, customerName: true, contactEmail: true,
          contactPhone: true, interest: true, ownerName: true, qualification: true,
          status: true, nextAction: true, nextActionAt: true, slaDueAt: true, createdAt: true,
        },
      }),
      prisma.opportunity.findMany({
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true, code: true, customerId: true, customerName: true, ownerName: true,
          need: true, budget: true, currency: true, expectedCloseDate: true,
          probability: true, stage: true, nextAction: true, nextActionAt: true, risks: true, updatedAt: true,
        },
      }),
      prisma.quote.findMany({
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true, code: true, opportunityId: true, customerName: true, currency: true,
          version: true, discount: true, fees: true, validUntil: true, status: true,
          approval: true, approvedBy: true, acceptedAt: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.sale.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, code: true, quoteId: true, customerName: true, amount: true,
          currency: true, status: true, closedAt: true, orderId: true, createdAt: true,
        },
      }),
      prisma.quote.count({ where: { status: "SENT" } }),
    ]);

    // KPI (Phase 2 §8): new leads, active opportunities, quotes pending, sales,
    // conversion, average check, forecast (взвешенная сумма воронки), overdue next actions.
    const newLeads = leads.filter((l) => l.status === "NEW").length;
    const wonSales = sales.filter((s) => s.status === "WON");
    const salesCount = sales.length;
    const conversion = opportunities.length ? Math.round((wonSales.length / opportunities.length) * 100) : 0;
    const avgCheck = wonSales.length
      ? Math.round(wonSales.reduce((a, s) => a + s.amount, 0) / wonSales.length)
      : 0;
    const forecast = opportunities
      .filter((o) => ["QUALIFICATION", "NEED_ANALYSIS", "QUOTE", "NEGOTIATION"].includes(o.stage))
      .reduce((a, o) => a + (o.budget ?? 0) * (o.probability / 100), 0);
    const now = Date.now();
    const overdue = [
      ...leads.filter((l) => l.nextActionAt && new Date(l.nextActionAt).getTime() < now && l.status === "NEW"),
      ...opportunities.filter(
        (o) =>
          o.nextActionAt &&
          new Date(o.nextActionAt).getTime() < now &&
          ["QUALIFICATION", "NEED_ANALYSIS", "QUOTE", "NEGOTIATION"].includes(o.stage)
      ),
    ].length;

    return NextResponse.json({
      kpi: {
        newLeads,
        activeOpportunities: opportunities.length,
        quotesPending,
        sales: salesCount,
        conversion,
        avgCheck,
        forecast: Math.round(forecast),
        overdueNextActions: overdue,
      },
      leads,
      opportunities,
      quotes,
      sales,
    });
  } catch (error) {
    return serverErrorResponse(error, "Sales Center GET error");
  }
}

/**
 * POST /api/admin/sales — создание Lead / Opportunity / Quote.
 * Quote создаётся с позициями (items: [{ serviceId, quantity }]) — снимок Product.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const entity = body.entity;

    if (entity === "lead") {
      const customerName = typeof body.customerName === "string" && body.customerName.trim() ? body.customerName.trim() : "";
      if (!customerName) return NextResponse.json({ error: "Укажите имя клиента" }, { status: 400 });
      const leads = await prisma.lead.findMany({ select: { code: true } });
      const lead = await prisma.lead.create({
        data: {
          code: nextBusinessCode("LED", leads.map((l) => l.code)),
          source: typeof body.source === "string" && body.source ? body.source : "Сайт",
          customerId: typeof body.customerId === "string" && body.customerId ? body.customerId : null,
          customerName,
          contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : null,
          contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : null,
          interest: typeof body.interest === "string" ? body.interest : null,
          ownerId: user.id,
          ownerName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
          qualification: ["cold", "warm", "hot"].includes(String(body.qualification)) ? String(body.qualification) : "cold",
          status: "NEW",
          nextAction: typeof body.nextAction === "string" ? body.nextAction : null,
          nextActionAt: typeof body.nextActionAt === "string" ? new Date(body.nextActionAt) : null,
          slaDueAt: typeof body.slaDueAt === "string" ? new Date(body.slaDueAt) : null,
        },
        select: { id: true, code: true, customerName: true, status: true, createdAt: true },
      });
      await prisma.leadHistory.create({
        data: {
          leadId: lead.id,
          action: "created",
          from: null,
          to: "NEW",
          actorId: user.id,
          actorName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
          comment: "Лид создан",
        },
      });
      return NextResponse.json({ ok: true, item: lead }, { status: 201 });
    }

    if (entity === "opportunity") {
      const customerName = typeof body.customerName === "string" && body.customerName.trim() ? body.customerName.trim() : "";
      if (!customerName) return NextResponse.json({ error: "Укажите имя клиента" }, { status: 400 });
      const opps = await prisma.opportunity.findMany({ select: { code: true } });
      const opportunity = await prisma.opportunity.create({
        data: {
          code: nextBusinessCode("OPP", opps.map((o) => o.code)),
          customerId: typeof body.customerId === "string" && body.customerId ? body.customerId : "unknown",
          customerName,
          contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : null,
          contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : null,
          ownerId: user.id,
          ownerName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
          need: typeof body.need === "string" ? body.need : null,
          productsRef: Array.isArray(body.products) ? JSON.stringify(body.products) : "[]",
          budget: typeof body.budget === "number" ? body.budget : null,
          currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
          expectedCloseDate: typeof body.expectedCloseDate === "string" ? new Date(body.expectedCloseDate) : null,
          probability: typeof body.probability === "number" ? Math.max(0, Math.min(100, Math.round(body.probability))) : 50,
          stage: "QUALIFICATION",
          nextAction: typeof body.nextAction === "string" ? body.nextAction : null,
          nextActionAt: typeof body.nextActionAt === "string" ? new Date(body.nextActionAt) : null,
          risks: typeof body.risks === "string" ? body.risks : null,
        },
        select: { id: true, code: true, customerName: true, stage: true, createdAt: true },
      });
      return NextResponse.json({ ok: true, item: opportunity }, { status: 201 });
    }

    if (entity === "quote") {
      const opportunityId = typeof body.opportunityId === "string" ? body.opportunityId : "";
      if (!opportunityId) return NextResponse.json({ error: "Укажите opportunityId" }, { status: 400 });
      const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
      if (!opportunity) return NextResponse.json({ error: "Возможность не найдена" }, { status: 404 });
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "Укажите хотя бы одну позицию предложения" }, { status: 400 });
      }
      const serviceIds = body.items.map((i) => (i as { serviceId?: string }).serviceId).filter((x): x is string => !!x);
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, title: true, type: true, price: true, currency: true },
      });
      const svcById = new Map(services.map((s) => [s.id, s]));
      const items = body.items
        .map((raw) => {
          const it = raw as { serviceId?: string; quantity?: number };
          const svc = it.serviceId ? svcById.get(it.serviceId) : undefined;
          if (!svc) return null;
          const quantity = Math.max(1, Math.round(Number(it.quantity) || 1));
          return { service: svc, quantity, price: svc.price, amount: Math.round(svc.price * quantity * 100) / 100 };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
      if (items.length === 0) return NextResponse.json({ error: "Ни одна позиция не найдена в каталоге" }, { status: 400 });

      const quotes = await prisma.quote.findMany({ select: { code: true } });
      const quote = await prisma.$transaction(async (tx) => {
        const q = await tx.quote.create({
          data: {
            code: nextBusinessCode("QTE", quotes.map((x) => x.code)),
            opportunityId,
            customerId: opportunity.customerId,
            customerName: opportunity.customerName,
            currency: typeof body.currency === "string" && body.currency ? body.currency : opportunity.currency,
            version: 1,
            discount: typeof body.discount === "number" ? body.discount : 0,
            fees: typeof body.fees === "number" ? body.fees : 0,
            validUntil: typeof body.validUntil === "string" ? new Date(body.validUntil) : null,
            status: "DRAFT",
            approval: "pending",
          },
          select: { id: true, code: true },
        });
        for (const it of items) {
          await tx.quoteItem.create({
            data: {
              quoteId: q.id,
              serviceId: it.service.id,
              title: it.service.title,
              type: it.service.type,
              quantity: it.quantity,
              price: it.price,
              amount: it.amount,
            },
          });
        }
        return q;
      });

      return NextResponse.json({ ok: true, item: { id: quote.id, code: quote.code, items: items.length } }, { status: 201 });
    }

    return NextResponse.json({ error: "Неизвестная сущность" }, { status: 400 });
  } catch (error) {
    return serverErrorResponse(error, "Sales Center POST error");
  }
}
