import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { FINANCE_ROLES, requireRole } from "@/lib/admin-access";
import { nextBusinessCode } from "@/lib/ids";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Finance Center (Phase 2, Baseline §0.6). Владелец финансовых сущностей —
 * ТОЛЬКО Finance (Settings не владеет Currency/Tax).
 *
 * GET /api/admin/finance — реестр: payments, refunds, invoices, commissions,
 *   currencies, exchange rates, taxes, tax rules + KPI-панель.
 *
 * POST /api/admin/finance — создание (entity: payment|refund|invoice|commission|
 *   currency|rate|tax|taxrule).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FINANCE_ROLES);
    if (denied) return denied;

    const [payments, refunds, invoices, commissions, currencies, rates, taxes, taxRules] = await Promise.all([
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { order: { select: { orderNumber: true } } },
      }),
      prisma.refund.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { order: { select: { orderNumber: true } } },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { order: { select: { orderNumber: true } } },
      }),
      prisma.commission.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { order: { select: { orderNumber: true } } },
      }),
      prisma.currency.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 50 }),
      prisma.tax.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.taxRule.findMany({ orderBy: { createdAt: "asc" }, include: { tax: { select: { name: true, rate: true } } } }),
    ]);

    const totalReceived = payments.filter((p) => p.status === "RECEIVED").reduce((a, p) => a + p.amount, 0);
    const totalRefunded = refunds.filter((r) => r.status === "COMPLETED").reduce((a, r) => a + r.amount, 0);
    const pendingPayments = payments.filter((p) => p.status === "CREATED").length;
    const pendingRefunds = refunds.filter((r) => r.status === "REQUESTED").length;
    const totalCommissions = commissions.reduce((a, c) => a + c.amount, 0);
    const unpaidCommissions = commissions.filter((c) => c.status === "PENDING").reduce((a, c) => a + c.amount, 0);

    return NextResponse.json({
      kpi: {
        totalReceived: Math.round(totalReceived),
        totalRefunded: Math.round(totalRefunded),
        net: Math.round(totalReceived - totalRefunded),
        pendingPayments,
        pendingRefunds,
        totalCommissions: Math.round(totalCommissions),
        unpaidCommissions: Math.round(unpaidCommissions),
        invoicesIssued: invoices.filter((i) => i.status !== "DRAFT").length,
        currenciesCount: currencies.length,
      },
      payments: payments.map((p) => ({ ...p, orderNumber: p.order?.orderNumber ?? null, order: undefined })),
      refunds: refunds.map((r) => ({ ...r, orderNumber: r.order?.orderNumber ?? null, order: undefined })),
      invoices: invoices.map((i) => ({ ...i, orderNumber: i.order?.orderNumber ?? null, order: undefined })),
      commissions: commissions.map((c) => ({ ...c, orderNumber: c.order?.orderNumber ?? null, order: undefined })),
      currencies,
      rates,
      taxes,
      taxRules,
    });
  } catch (error) {
    return serverErrorResponse(error, "Finance Center GET error");
  }
}

/**
 * POST /api/admin/finance — создание финансовых сущностей.
 * entity: payment | refund | invoice | commission | currency | rate | tax | taxrule
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FINANCE_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const entity = body.entity;
    const ctx = requestContext(request);

    if (entity === "payment") {
      const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : 0;
      if (!amount) return NextResponse.json({ error: "Укажите сумму платежа" }, { status: 400 });
      const orderId = typeof body.orderId === "string" && body.orderId ? body.orderId : null;
      const rows = await prisma.payment.findMany({ select: { code: true } });
      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            code: nextBusinessCode("PAY", rows.map((r) => r.code)),
            orderId,
            saleId: typeof body.saleId === "string" && body.saleId ? body.saleId : null,
            customerId: typeof body.customerId === "string" && body.customerId ? body.customerId : null,
            amount: Math.round(amount * 100) / 100,
            currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
            method: typeof body.method === "string" && body.method ? body.method : "Банковский перевод",
            status: "CREATED",
          },
          select: { id: true, code: true, amount: true, status: true },
        });
        // Outbox (Phase 2 §7): PaymentCreated атомарно с созданием платежа.
        if (orderId) {
          await emitOrderEvent(tx, orderId, "PAYMENT_CREATED", {
            paymentCode: p.code, amount: p.amount, currency: String(body.currency ?? "USD"),
          });
        }
        return p;
      });
      await publishOrderEvents();
      await recordAudit({
        user, category: "Финансовые операции", action: "payment",
        objectType: "Платёж", objectId: payment.id, objectNumber: payment.code,
        toData: { amount: payment.amount, status: payment.status },
        comment: `Создан платёж ${payment.code}`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
      });
      return NextResponse.json({ ok: true, item: payment }, { status: 201 });
    }

    if (entity === "refund") {
      const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : 0;
      if (!amount) return NextResponse.json({ error: "Укажите сумму возврата" }, { status: 400 });
      const rows = await prisma.refund.findMany({ select: { code: true } });
      const refund = await prisma.$transaction(async (tx) => {
        const r = await tx.refund.create({
          data: {
            code: nextBusinessCode("RFD", rows.map((x) => x.code)),
            orderId: typeof body.orderId === "string" && body.orderId ? body.orderId : null,
            paymentId: typeof body.paymentId === "string" && body.paymentId ? body.paymentId : null,
            amount: Math.round(amount * 100) / 100,
            currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
            reason: typeof body.reason === "string" ? body.reason : null,
            status: "REQUESTED",
          },
          select: { id: true, code: true, amount: true, status: true },
        });
        if (typeof body.orderId === "string" && body.orderId) {
          await emitOrderEvent(tx, String(body.orderId), "REFUND_REQUESTED", {
            refundCode: r.code, amount: r.amount, currency: String(body.currency ?? "USD"),
          });
        }
        return r;
      });
      await publishOrderEvents();
      await recordAudit({
        user, category: "Финансовые операции", action: "refund",
        objectType: "Возврат", objectId: refund.id, objectNumber: refund.code,
        toData: { amount: refund.amount, status: refund.status },
        comment: `Запрошен возврат ${refund.code}`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
      });
      return NextResponse.json({ ok: true, item: refund }, { status: 201 });
    }

    if (entity === "invoice") {
      const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : 0;
      if (!amount) return NextResponse.json({ error: "Укажите сумму счёта" }, { status: 400 });
      const rows = await prisma.invoice.findMany({ select: { code: true } });
      const invoice = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            code: nextBusinessCode("INV", rows.map((x) => x.code)),
            orderId: typeof body.orderId === "string" && body.orderId ? body.orderId : null,
            saleId: typeof body.saleId === "string" && body.saleId ? body.saleId : null,
            customerId: typeof body.customerId === "string" && body.customerId ? body.customerId : null,
            amount: Math.round(amount * 100) / 100,
            currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
            status: "DRAFT",
            dueAt: typeof body.dueAt === "string" ? new Date(body.dueAt) : null,
          },
          select: { id: true, code: true, amount: true, status: true },
        });
        return inv;
      });
      await recordAudit({
        user, category: "Финансовые операции", action: "create",
        objectType: "Счёт", objectId: invoice.id, objectNumber: invoice.code,
        toData: { amount: invoice.amount },
        comment: `Создан счёт ${invoice.code}`, source: "Web", ip: ctx.ip, userAgent: ctx.userAgent,
      });
      return NextResponse.json({ ok: true, item: invoice }, { status: 201 });
    }

    if (entity === "commission") {
      const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : 0;
      if (!amount) return NextResponse.json({ error: "Укажите сумму комиссии" }, { status: 400 });
      const rows = await prisma.commission.findMany({ select: { code: true } });
      const commission = await prisma.$transaction(async (tx) => {
        const c = await tx.commission.create({
          data: {
            code: nextBusinessCode("CMS", rows.map((x) => x.code)),
            orderId: typeof body.orderId === "string" && body.orderId ? body.orderId : null,
            partnerId: typeof body.partnerId === "string" && body.partnerId ? body.partnerId : null,
            amount: Math.round(amount * 100) / 100,
            currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
            rate: typeof body.rate === "number" ? body.rate : 0,
            status: "PENDING",
          },
          select: { id: true, code: true, amount: true, status: true },
        });
        return c;
      });
      return NextResponse.json({ ok: true, item: commission }, { status: 201 });
    }

    if (entity === "currency") {
      const code = typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase() : "";
      if (!code) return NextResponse.json({ error: "Укажите код валюты" }, { status: 400 });
      const rows = await prisma.currency.findMany({ select: { code: true } });
      const currency = await prisma.currency.create({
        data: {
          code: nextBusinessCode("CUR", rows.map((x) => x.code)),
          name: typeof body.name === "string" && body.name ? body.name : code,
          symbol: typeof body.symbol === "string" && body.symbol ? body.symbol : code,
          isBase: body.isBase === true,
          isActive: body.isActive !== false,
        },
        select: { id: true, code: true, name: true, isBase: true },
      });
      return NextResponse.json({ ok: true, item: currency }, { status: 201 });
    }

    if (entity === "rate") {
      const fromCode = typeof body.fromCode === "string" && body.fromCode ? body.fromCode.toUpperCase() : "";
      const toCode = typeof body.toCode === "string" && body.toCode ? body.toCode.toUpperCase() : "";
      const rate = typeof body.rate === "number" && body.rate > 0 ? body.rate : 0;
      if (!fromCode || !toCode || !rate) return NextResponse.json({ error: "Укажите fromCode, toCode и rate" }, { status: 400 });
      const rows = await prisma.exchangeRate.findMany({ select: { code: true } });
      const item = await prisma.exchangeRate.create({
        data: {
          code: nextBusinessCode("FXR", rows.map((x) => x.code)),
          fromCode,
          toCode,
          rate: Math.round(rate * 10000) / 10000,
          date: typeof body.date === "string" ? new Date(body.date) : new Date(),
        },
        select: { id: true, code: true, fromCode: true, toCode: true, rate: true, date: true },
      });
      return NextResponse.json({ ok: true, item }, { status: 201 });
    }

    if (entity === "tax") {
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "";
      const rate = typeof body.rate === "number" ? body.rate : 0;
      if (!name) return NextResponse.json({ error: "Укажите название налога" }, { status: 400 });
      const rows = await prisma.tax.findMany({ select: { code: true } });
      const tax = await prisma.tax.create({
        data: {
          code: nextBusinessCode("TAX", rows.map((x) => x.code)),
          name,
          rate,
          isActive: body.isActive !== false,
        },
        select: { id: true, code: true, name: true, rate: true },
      });
      return NextResponse.json({ ok: true, item: tax }, { status: 201 });
    }

    if (entity === "taxrule") {
      const taxId = typeof body.taxId === "string" && body.taxId ? body.taxId : "";
      if (!taxId) return NextResponse.json({ error: "Укажите taxId" }, { status: 400 });
      const rows = await prisma.taxRule.findMany({ select: { code: true } });
      const rule = await prisma.taxRule.create({
        data: {
          code: nextBusinessCode("TXR", rows.map((x) => x.code)),
          taxId,
          country: typeof body.country === "string" && body.country ? body.country : null,
          serviceType: typeof body.serviceType === "string" && body.serviceType ? body.serviceType : null,
          rateOverride: typeof body.rateOverride === "number" ? body.rateOverride : null,
          isActive: body.isActive !== false,
        },
        select: { id: true, code: true, taxId: true, country: true, serviceType: true },
      });
      return NextResponse.json({ ok: true, item: rule }, { status: 201 });
    }

    return NextResponse.json({ error: "Неизвестная сущность" }, { status: 400 });
  } catch (error) {
    return serverErrorResponse(error, "Finance Center POST error");
  }
}
