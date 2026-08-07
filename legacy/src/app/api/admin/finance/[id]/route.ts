import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { FINANCE_ROLES, requireRole } from "@/lib/admin-access";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Finance Center (Phase 2, Baseline §0.6) — переходы статусов финансовых сущностей.
 * Тело: { entity, action }.
 *
 * payment:  receive (CREATED→RECEIVED, +PAYMENT_RECEIVED, +order.paidAmount)
 *           | fail
 * refund:   complete (REQUESTED→COMPLETED, +REFUND_COMPLETED, +order.paymentStatus REFUNDED)
 *           | fail
 * invoice:  issue (DRAFT→ISSUED, +INVOICE_ISSUED) | pay | void
 * commission: pay (PENDING→PAID)
 *
 * Finance изменяет Order НЕ напрямую по lifecycle, а только финансовое состояние
 * (paidAmount/paymentStatus) — агрегируется через события (Baseline §0.6, §7).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FINANCE_ROLES);
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
    const ctx = requestContext(request);

    if (entity === "payment") {
      const payment = await prisma.payment.findUnique({ where: { id } });
      if (!payment) return NextResponse.json({ error: "Платёж не найден" }, { status: 404 });

      if (action === "receive") {
        if (payment.status === "RECEIVED") return NextResponse.json({ error: "Платёж уже получен" }, { status: 409 });
        const updated = await prisma.$transaction(async (tx) => {
          const p = await tx.payment.update({
            where: { id },
            data: { status: "RECEIVED", receivedAt: new Date() },
            select: { id: true, code: true, status: true, amount: true, orderId: true, currency: true },
          });
          // Агрегация финансового состояния заказа (Baseline §0.6): только сумма,
          // не lifecycle-статус — Order владеет своим жизненным циклом.
          if (p.orderId) {
            const order = await tx.order.findUnique({ where: { id: p.orderId }, select: { paidAmount: true, amount: true } });
            if (order) {
              const paid = Math.min(order.amount, Math.round((order.paidAmount + p.amount) * 100) / 100);
              await tx.order.update({
                where: { id: p.orderId },
                data: {
                  paidAmount: paid,
                  paymentStatus: paid >= order.amount ? "PAID" : "PARTIALLY_PAID",
                },
              });
            }
          }
          await emitOrderEvent(tx, p.orderId, "PAYMENT_RECEIVED", {
            paymentCode: p.code, amount: p.amount, currency: p.currency,
          });
          return p;
        });
        await publishOrderEvents();
        await recordAudit({
          user, category: "Финансовые операции", action: "payment",
          objectType: "Платёж", objectId: id, objectNumber: updated.code,
          fromData: { status: payment.status }, toData: { status: "RECEIVED" },
          comment: `Платёж ${updated.code} получен`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      if (action === "fail") {
        const updated = await prisma.$transaction(async (tx) => {
          const p = await tx.payment.update({
            where: { id },
            data: { status: "FAILED" },
            select: { id: true, code: true, status: true, orderId: true, amount: true, currency: true },
          });
          await emitOrderEvent(tx, p.orderId, "PAYMENT_FAILED", {
            paymentCode: p.code, amount: p.amount, currency: p.currency,
          });
          return p;
        });
        await publishOrderEvents();
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для платежа" }, { status: 400 });
    }

    if (entity === "refund") {
      const refund = await prisma.refund.findUnique({ where: { id } });
      if (!refund) return NextResponse.json({ error: "Возврат не найден" }, { status: 404 });

      if (action === "complete") {
        if (refund.status === "COMPLETED") return NextResponse.json({ error: "Возврат уже выполнен" }, { status: 409 });
        const updated = await prisma.$transaction(async (tx) => {
          const r = await tx.refund.update({
            where: { id },
            data: { status: "COMPLETED", completedAt: new Date() },
            select: { id: true, code: true, status: true, amount: true, orderId: true, currency: true },
          });
          if (r.orderId) {
            await tx.order.update({
              where: { id: r.orderId },
              data: {
                paidAmount: 0,
                paymentStatus: "REFUNDED",
              },
            });
          }
          await emitOrderEvent(tx, r.orderId, "REFUND_COMPLETED", {
            refundCode: r.code, amount: r.amount, currency: r.currency,
          });
          return r;
        });
        await publishOrderEvents();
        await recordAudit({
          user, category: "Финансовые операции", action: "refund",
          objectType: "Возврат", objectId: id, objectNumber: updated.code,
          fromData: { status: refund.status }, toData: { status: "COMPLETED" },
          comment: `Возврат ${updated.code} выполнен`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      if (action === "fail") {
        const updated = await prisma.refund.update({
          where: { id },
          data: { status: "FAILED" },
          select: { id: true, code: true, status: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для возврата" }, { status: 400 });
    }

    if (entity === "invoice") {
      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice) return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });

      if (action === "issue") {
        if (invoice.status === "ISSUED") return NextResponse.json({ error: "Счёт уже выставлен" }, { status: 409 });
        const updated = await prisma.$transaction(async (tx) => {
          const inv = await tx.invoice.update({
            where: { id },
            data: { status: "ISSUED", issuedAt: new Date() },
            select: { id: true, code: true, status: true, orderId: true, amount: true, currency: true },
          });
          await emitOrderEvent(tx, inv.orderId, "INVOICE_ISSUED", {
            invoiceCode: inv.code, amount: inv.amount, currency: inv.currency,
          });
          return inv;
        });
        await publishOrderEvents();
        await recordAudit({
          user, category: "Документооборот", action: "document",
          objectType: "Счёт", objectId: id, objectNumber: updated.code,
          fromData: { status: invoice.status }, toData: { status: "ISSUED" },
          comment: `Счёт ${updated.code} выставлен`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      if (action === "pay") {
        const updated = await prisma.invoice.update({
          where: { id },
          data: { status: "PAID" },
          select: { id: true, code: true, status: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      if (action === "void") {
        const updated = await prisma.invoice.update({
          where: { id },
          data: { status: "VOID" },
          select: { id: true, code: true, status: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для счёта" }, { status: 400 });
    }

    if (entity === "commission") {
      const commission = await prisma.commission.findUnique({ where: { id } });
      if (!commission) return NextResponse.json({ error: "Комиссия не найдена" }, { status: 404 });

      if (action === "pay") {
        const updated = await prisma.commission.update({
          where: { id },
          data: { status: "PAID", paidAt: new Date() },
          select: { id: true, code: true, status: true, amount: true, currency: true },
        });
        return NextResponse.json({ ok: true, item: updated });
      }

      return NextResponse.json({ error: "Недопустимое действие для комиссии" }, { status: 400 });
    }

    return NextResponse.json({ error: "Неизвестная сущность" }, { status: 400 });
  } catch (error) {
    return serverErrorResponse(error, "Finance Center PATCH error");
  }
}
