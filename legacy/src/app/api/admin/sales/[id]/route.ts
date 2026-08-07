import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";
import { nextBusinessCode } from "@/lib/ids";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Sales Center (Phase 2, Baseline §0.7) — действия над сущностями.
 * Тело: { entity, action, ... }.
 *
 * Lead:         qualify  (→ Opportunity) | disqualify | convert | lost | update
 * Opportunity:  stage (QUALIFICATION→NEED_ANALYSIS→QUOTE→NEGOTIATION→WON/LOST)
 *               | update
 * Quote:        send | version (новая редакция с инкрементом) | accept (→ Sale
 *               + QUOTE_ACCEPTED) | reject | update
 * Sale:         complete (SALE_COMPLETED + ORDER_REQUESTED → Order Center)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const entity = body.entity;
    const action = typeof body.action === "string" ? body.action : "";
    const actorName = `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор";
    const ctx = requestContext(request);

    if (entity === "lead") {
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead) return NextResponse.json({ error: "Лид не найден" }, { status: 404 });

      if (action === "qualify") {
        // Успешная квалификация создаёт Opportunity (Phase 2 §3 Lead).
        const opps = await prisma.opportunity.findMany({ select: { code: true } });
        const opportunity = await prisma.$transaction(async (tx) => {
          const opp = await tx.opportunity.create({
            data: {
              code: nextBusinessCode("OPP", opps.map((o) => o.code)),
              customerId: lead.customerId ?? "unknown",
              customerName: lead.customerName,
              contactEmail: lead.contactEmail,
              contactPhone: lead.contactPhone,
              ownerId: lead.ownerId,
              ownerName: lead.ownerName,
              need: lead.interest,
              currency: "USD",
              probability: 50,
              stage: "QUALIFICATION",
              nextAction: lead.nextAction,
              nextActionAt: lead.nextActionAt,
            },
            select: { id: true, code: true },
          });
          await tx.lead.update({ where: { id }, data: { status: "QUALIFIED" } });
          await tx.leadHistory.create({
            data: {
              leadId: id,
              action: "qualify",
              from: lead.status,
              to: "QUALIFIED",
              actorId: user.id,
              actorName,
              comment: `Лид квалифицирован → возможность ${opp.code}`,
            },
          });
          return opp;
        });
        return NextResponse.json({ ok: true, message: "Лид квалифицирован", opportunity, leadId: id });
      }

      if (action === "disqualify" || action === "lost") {
        const to = "DISQUALIFIED";
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.lead.update({ where: { id }, data: { status: to } });
          await tx.leadHistory.create({
            data: {
              leadId: id,
              action: action === "lost" ? "lost" : "disqualify",
              from: lead.status,
              to,
              actorId: user.id,
              actorName,
              comment: typeof body.comment === "string" ? body.comment : "Лид отклонён",
            },
          });
          return u;
        });
        await recordAudit({
          user, category: "Пользовательские действия", action: "status",
          objectType: "Лид", objectId: id, objectNumber: lead.code,
          fromData: { status: lead.status }, toData: { status: to },
          comment: `Лид ${lead.code} отклонён`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({ ok: true, item: { id: updated.id, status: updated.status } });
      }

      if (action === "convert") {
        // Конвертация в клиента CRM не выполняется (CUS-* создаёт CRM) — помечаем лид.
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.lead.update({ where: { id }, data: { status: "CONVERTED" } });
          await tx.leadHistory.create({
            data: {
              leadId: id,
              action: "convert",
              from: lead.status,
              to: "CONVERTED",
              actorId: user.id,
              actorName,
              comment: "Лид конвертирован в клиента",
            },
          });
          return u;
        });
        return NextResponse.json({ ok: true, item: { id: updated.id, status: updated.status } });
      }

      if (action === "update") {
        const updated = await prisma.lead.update({
          where: { id },
          data: {
            ...(typeof body.customerName === "string" && body.customerName ? { customerName: String(body.customerName) } : {}),
            ...(typeof body.contactEmail === "string" ? { contactEmail: String(body.contactEmail) } : {}),
            ...(typeof body.contactPhone === "string" ? { contactPhone: String(body.contactPhone) } : {}),
            ...(typeof body.interest === "string" ? { interest: String(body.interest) } : {}),
            ...(typeof body.qualification === "string" ? { qualification: String(body.qualification) } : {}),
            ...(typeof body.nextAction === "string" ? { nextAction: String(body.nextAction) } : {}),
            ...(typeof body.nextActionAt === "string" ? { nextActionAt: new Date(String(body.nextActionAt)) } : {}),
            ...(typeof body.slaDueAt === "string" ? { slaDueAt: new Date(String(body.slaDueAt)) } : {}),
          },
          select: { id: true, status: true, customerName: true, updatedAt: true },
        });
        await prisma.leadHistory.create({
          data: {
            leadId: id, action: "update", from: lead.status, to: lead.status,
            actorId: user.id, actorName, comment: "Лид обновлён",
          },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для лида" }, { status: 400 });
    }

    if (entity === "opportunity") {
      const opp = await prisma.opportunity.findUnique({ where: { id } });
      if (!opp) return NextResponse.json({ error: "Возможность не найдена" }, { status: 404 });

      const STAGES = ["QUALIFICATION", "NEED_ANALYSIS", "QUOTE", "NEGOTIATION", "WON", "LOST"];

      if (action === "stage") {
        const to = typeof body.to === "string" && STAGES.includes(body.to) ? body.to : "";
        if (!to) return NextResponse.json({ error: "Недопустимая стадия" }, { status: 400 });
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.opportunity.update({
            where: { id },
            data: {
              stage: to,
              probability: typeof body.probability === "number" ? Math.max(0, Math.min(100, Math.round(body.probability))) : opp.probability,
              expectedCloseDate: typeof body.expectedCloseDate === "string" ? new Date(body.expectedCloseDate) : opp.expectedCloseDate,
            },
          });
          return u;
        });
        await recordAudit({
          user, category: "Пользовательские действия", action: "status",
          objectType: "Возможность", objectId: id, objectNumber: opp.code,
          fromData: { stage: opp.stage }, toData: { stage: to },
          comment: `Возможность ${opp.code}: ${opp.stage} → ${to}`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({ ok: true, item: { id: updated.id, stage: updated.stage, probability: updated.probability } });
      }

      if (action === "update") {
        const updated = await prisma.opportunity.update({
          where: { id },
          data: {
            ...(typeof body.need === "string" ? { need: String(body.need) } : {}),
            ...(typeof body.budget === "number" ? { budget: body.budget } : {}),
            ...(typeof body.probability === "number" ? { probability: Math.max(0, Math.min(100, Math.round(body.probability))) } : {}),
            ...(typeof body.expectedCloseDate === "string" ? { expectedCloseDate: new Date(String(body.expectedCloseDate)) } : {}),
            ...(typeof body.nextAction === "string" ? { nextAction: String(body.nextAction) } : {}),
            ...(typeof body.nextActionAt === "string" ? { nextActionAt: new Date(String(body.nextActionAt)) } : {}),
            ...(typeof body.risks === "string" ? { risks: String(body.risks) } : {}),
          },
          select: { id: true, stage: true, probability: true, budget: true, updatedAt: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для возможности" }, { status: 400 });
    }

    if (entity === "quote") {
      const quote = await prisma.quote.findUnique({ where: { id }, include: { items: true, opportunity: true } });
      if (!quote) return NextResponse.json({ error: "Предложение не найдено" }, { status: 404 });

      if (action === "send") {
        const updated = await prisma.quote.update({
          where: { id },
          data: { status: "SENT" },
          select: { id: true, code: true, status: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      if (action === "version") {
        // Новая редакция: версия инкрементируется (Phase 2 §3 Quote: versions).
        // Если переданы items — заменяем состав снимка.
        type ItemInput = { serviceId: string; title: string; type: string; quantity: number; price: number; amount: number };
        let itemsData: ItemInput[] = quote.items.map((i) => ({
          serviceId: i.serviceId, title: i.title, type: i.type, quantity: i.quantity, price: i.price, amount: i.amount,
        }));
        if (Array.isArray(body.items) && body.items.length > 0) {
          const serviceIds = body.items.map((i) => (i as { serviceId?: string }).serviceId).filter((x): x is string => !!x);
          const services = await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, title: true, type: true, price: true },
          });
          const svcById = new Map(services.map((s) => [s.id, s]));
          itemsData = body.items
            .map((raw) => {
              const it = raw as { serviceId?: string; quantity?: number };
              const svc = it.serviceId ? svcById.get(it.serviceId) : undefined;
              if (!svc) return null;
              const quantity = Math.max(1, Math.round(Number(it.quantity) || 1));
              return {
                serviceId: svc.id,
                title: svc.title,
                type: svc.type as string,
                quantity,
                price: svc.price,
                amount: Math.round(svc.price * quantity * 100) / 100,
              };
            })
            .filter((x): x is ItemInput => !!x);
        }
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.quote.update({
            where: { id },
            data: {
              version: { increment: 1 },
              status: "DRAFT",
              discount: typeof body.discount === "number" ? body.discount : quote.discount,
              fees: typeof body.fees === "number" ? body.fees : quote.fees,
              validUntil: typeof body.validUntil === "string" ? new Date(String(body.validUntil)) : quote.validUntil,
            },
            select: { id: true, code: true, version: true, status: true },
          });
          if (Array.isArray(body.items) && body.items.length > 0) {
            await tx.quoteItem.deleteMany({ where: { quoteId: id } });
            for (const it of itemsData) {
              await tx.quoteItem.create({
                data: {
                  quoteId: id, serviceId: it.serviceId, title: it.title, type: it.type as never,
                  quantity: it.quantity, price: it.price, amount: it.amount,
                },
              });
            }
          }
          return u;
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      if (action === "accept") {
        // Quote accepted → Sale + QUOTE_ACCEPTED (Phase 2 §4).
        if (quote.status === "ACCEPTED") {
          return NextResponse.json({ error: "Предложение уже принято" }, { status: 409 });
        }
        const amount = Math.round(
          (quote.items.reduce((a, i) => a + i.amount, 0) - (quote.discount || 0) + (quote.fees || 0)) * 100
        ) / 100;
        const sales = await prisma.sale.findMany({ select: { code: true } });
        const sale = await prisma.$transaction(async (tx) => {
          const s = await tx.sale.create({
            data: {
              code: nextBusinessCode("SAL", sales.map((x) => x.code)),
              quoteId: id,
              customerId: quote.customerId,
              customerName: quote.customerName,
              amount,
              currency: quote.currency,
              status: "WON",
              closedAt: new Date(),
            },
            select: { id: true, code: true },
          });
          await tx.quote.update({
            where: { id },
            data: { status: "ACCEPTED", approval: "approved", approvedBy: actorName, acceptedAt: new Date() },
          });
          // Outbox: QUOTE_ACCEPTED — атомарно с принятием (correlationId = sale.code).
          await emitOrderEvent(tx, null, "QUOTE_ACCEPTED", {
            saleCode: s.code, quoteCode: quote.code, amount, currency: quote.currency,
          }, { correlationId: s.code });
          return s;
        });
        await publishOrderEvents();
        await recordAudit({
          user, category: "Пользовательские действия", action: "status",
          objectType: "Предложение", objectId: id, objectNumber: quote.code,
          fromData: { status: quote.status }, toData: { status: "ACCEPTED" },
          comment: `Предложение ${quote.code} принято → сделка ${sale.code}`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({ ok: true, message: "Предложение принято, сделка создана", sale });
      }

      if (action === "reject") {
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.quote.update({
            where: { id },
            data: { status: "REJECTED", approval: "rejected", approvedBy: actorName },
            select: { id: true, code: true, status: true },
          });
          await tx.opportunity.update({
            where: { id: quote.opportunityId },
            data: { stage: "NEGOTIATION" },
          });
          return u;
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для предложения" }, { status: 400 });
    }

    if (entity === "sale") {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { quote: { include: { items: true } }, order: true },
      });
      if (!sale) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 });

      if (action === "complete") {
        // SaleCompleted → OrderRequested (Phase 2 §3 Sale): Order Center создаст
        // ORD-*/TH-* заказ и OrderItems через идемпотентный consumer.
        if (sale.orderId) {
          return NextResponse.json({ ok: true, message: "Заказ уже создан", orderId: sale.orderId });
        }
        await prisma.$transaction(async (tx) => {
          const ev = await emitOrderEvent(tx, null, "SALE_COMPLETED", {
            saleCode: sale.code, amount: sale.amount, currency: sale.currency,
            customerId: sale.customerId, customerName: sale.customerName,
          }, { correlationId: sale.code });
          await emitOrderEvent(tx, null, "ORDER_REQUESTED", {
            saleId: sale.id,
            saleCode: sale.code,
            customerId: sale.customerId,
            customerName: sale.customerName,
            currency: sale.currency,
            amount: sale.amount,
            source: "Sales Center",
            items: sale.quote.items.map((i) => ({
              serviceId: i.serviceId, title: i.title, type: i.type,
              quantity: i.quantity, price: i.price, amount: i.amount,
            })),
          }, { correlationId: sale.code, causationId: ev });
        });
        await publishOrderEvents();
        // Перечитываем сделку: consumer уже связал Order.
        const after = await prisma.sale.findUnique({
          where: { id },
          select: { orderId: true, code: true, status: true },
        });
        await recordAudit({
          user, category: "Пользовательские действия", action: "create",
          objectType: "Сделка", objectId: id, objectNumber: sale.code,
          toData: { orderId: after?.orderId ?? null },
          comment: `Сделка ${sale.code} завершена — отправлен OrderRequested`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({
          ok: true,
          message: after?.orderId ? "Сделка завершена, заказ создан" : "Сделка завершена, OrderRequested отправлен",
          orderId: after?.orderId ?? null,
        });
      }

      if (action === "cancel") {
        const updated = await prisma.sale.update({
          where: { id },
          data: { status: "CANCELLED" },
          select: { id: true, code: true, status: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для сделки" }, { status: 400 });
    }

    return NextResponse.json({ error: "Неизвестная сущность" }, { status: 400 });
  } catch (error) {
    return serverErrorResponse(error, "Sales Center PATCH error");
  }
}
