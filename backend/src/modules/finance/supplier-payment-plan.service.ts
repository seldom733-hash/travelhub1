import { ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ValidationDomainError } from "../../shared/errors";

const VIEW_ROLES = new Set(["FINANCE", "ADMIN", "DIRECTOR"]);
const WRITE_ROLES = new Set(["FINANCE", "ADMIN"]);
const DAY_MS = 24 * 60 * 60 * 1000;

type Actor = { id: string; username: string; role: string };

function assertRole(actor: Actor, write: boolean): void {
  const allowed = write ? WRITE_ROLES : VIEW_ROLES;
  if (!allowed.has(actor?.role)) {
    throw new ForbiddenException("Payment terms are available to FINANCE, ADMIN and DIRECTOR only");
  }
}

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function num(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

@Injectable()
export class SupplierPaymentPlanService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    // Daily reminders are idempotent (dedupeKey), so a 6h tick is harmless and
    // recovers missed runs after a restart.
    this.timer = setInterval(() => void this.runReminders().catch(() => undefined), 6 * 60 * 60 * 1000);
    this.timer.unref?.();
    setTimeout(() => void this.runReminders().catch(() => undefined), 10_000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async list(actor: Actor) {
    assertRole(actor, false);
    const obligations = await this.prisma.supplierObligation.findMany({
      where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 300,
    });
    if (obligations.length === 0) return [];

    const orderIds = [...new Set(obligations.map((o) => o.orderId))];
    const bookingIds = [...new Set(obligations.map((o) => o.bookingId).filter(Boolean))] as string[];
    const [orders, bookings, plans] = await Promise.all([
      this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, referenceNumber: true } }),
      this.prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, referenceNumber: true, status: true, serviceDate: true },
      }),
      this.prisma.supplierPaymentPlan.findMany({
        where: { obligationId: { in: obligations.map((o) => o.id) } },
        include: { installments: { orderBy: { sortOrder: "asc" } } },
      }),
    ]);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const bookingById = new Map(bookings.map((b) => [b.id, b]));
    const planByObligation = new Map(plans.map((p) => [p.obligationId, p]));

    return obligations.map((o) => {
      const plan = planByObligation.get(o.id);
      const booking = bookingById.get(o.bookingId);
      return {
        obligationId: o.id,
        obligationCode: o.code,
        orderId: o.orderId,
        orderCode: orderById.get(o.orderId)?.referenceNumber ?? o.orderCode ?? null,
        bookingId: o.bookingId,
        bookingCode: booking?.referenceNumber ?? o.bookingCode ?? null,
        bookingStatus: booking?.status ?? null,
        serviceDate: isoDate(booking?.serviceDate),
        supplierCode: o.supplierCode,
        sourceAmount: num(o.sourceAmount),
        sourceCurrency: o.sourceCurrency,
        amount: num(o.aznAmount),
        paidAmount: num(o.paidAmount),
        remainingAmount: num(o.remainingAmount),
        dueDate: isoDate(o.dueDate),
        status: o.status,
        plan: plan
          ? {
              id: plan.id,
              mode: plan.mode,
              installments: plan.installments.map((i) => ({
                id: i.id,
                kind: i.kind,
                dueDate: isoDate(i.dueDate),
                amount: num(i.amount),
                status: i.status,
              })),
            }
          : null,
      };
    });
  }

  async upsert(
    obligationId: string,
    input: { mode?: string; installments?: Array<{ kind?: string; dueDate?: string; amount?: number }> },
    actor: Actor,
  ) {
    assertRole(actor, true);
    const obligation = await this.prisma.supplierObligation.findUnique({ where: { id: obligationId } });
    if (!obligation) throw new NotFoundException(`Supplier obligation ${obligationId} not found`);
    if (!["OPEN", "PARTIALLY_PAID"].includes(obligation.status)) {
      throw new ValidationDomainError("Payment plan can be set only for an open or partially paid obligation");
    }

    const mode = (input.mode ?? "").trim().toUpperCase();
    if (mode !== "FULL" && mode !== "PARTIAL") {
      throw new ValidationDomainError("mode must be FULL or PARTIAL");
    }
    const total = num(obligation.remainingAmount) > 0 ? num(obligation.remainingAmount) : num(obligation.aznAmount);
    if (!(total > 0)) throw new ValidationDomainError("Obligation has no payable AZN amount");

    const raw = Array.isArray(input.installments) ? input.installments : [];
    const normalized = raw.map((row, index) => {
      const amount = Number(row.amount);
      const due = new Date(String(row.dueDate ?? ""));
      if (!Number.isFinite(amount) || amount <= 0) throw new ValidationDomainError(`installment ${index + 1}: amount must be positive`);
      if (Number.isNaN(due.getTime())) throw new ValidationDomainError(`installment ${index + 1}: dueDate is invalid`);
      return {
        kind: String(row.kind ?? "").trim().toUpperCase(),
        dueDate: dateOnly(due),
        amount: Math.round(amount * 100) / 100,
      };
    });

    if (mode === "FULL") {
      if (normalized.length !== 1) throw new ValidationDomainError("FULL payment requires exactly one date and amount");
      normalized[0].kind = "FULL";
    } else {
      if (normalized.length !== 2) throw new ValidationDomainError("PARTIAL payment requires first and last payment");
      if (normalized[0].kind !== "FIRST" || normalized[1].kind !== "LAST") {
        throw new ValidationDomainError("PARTIAL payment must contain FIRST then LAST");
      }
      if (normalized[0].dueDate >= normalized[1].dueDate) {
        throw new ValidationDomainError("First payment date must be before the last payment date");
      }
    }
    const sum = Math.round(normalized.reduce((s, row) => s + row.amount, 0) * 100) / 100;
    if (Math.abs(sum - total) > 0.01) {
      throw new ValidationDomainError(`Installments must sum to ${total.toFixed(2)} AZN`);
    }

    const lastDate = normalized.reduce((max, row) => (row.dueDate > max ? row.dueDate : max), normalized[0].dueDate);
    const previous = await this.prisma.supplierPaymentPlan.findUnique({
      where: { obligationId },
      include: { installments: true },
    });
    const plan = await this.prisma.$transaction(async (tx) => {
      if (previous) {
        await tx.supplierPaymentPlan.delete({ where: { id: previous.id } });
      }
      const saved = await tx.supplierPaymentPlan.create({
        data: {
          obligationId,
          mode,
          createdById: actor.id,
          installments: {
            create: normalized.map((row, index) => ({
              kind: row.kind,
              dueDate: row.dueDate,
              amount: new Prisma.Decimal(row.amount.toFixed(2)),
              status: "PLANNED",
              sortOrder: index,
            })),
          },
        },
        include: { installments: { orderBy: { sortOrder: "asc" } } },
      });
      await tx.supplierObligation.update({ where: { id: obligationId }, data: { dueDate: lastDate } });
      await this.security.audit(tx, {
        action: "finance.supplier_payment_plan.updated",
        resource: "SupplierPaymentPlan",
        resourceId: saved.id,
        details: {
          obligationId,
          obligationCode: obligation.code,
          mode,
          installments: normalized.map((r) => ({ kind: r.kind, dueDate: isoDate(r.dueDate), amount: r.amount })),
          previousMode: previous?.mode ?? null,
          actor: actor.username,
        },
      });
      return saved;
    });

    return {
      obligationId,
      mode: plan.mode,
      dueDate: isoDate(lastDate),
      installments: plan.installments.map((i) => ({
        id: i.id,
        kind: i.kind,
        dueDate: isoDate(i.dueDate),
        amount: num(i.amount),
        status: i.status,
      })),
    };
  }

  async runReminders(): Promise<{ created: number; checked: number; overdue: number }> {
    const today = dateOnly(new Date());
    const inThreeDays = new Date(today.getTime() + 3 * DAY_MS);
    const installments = await this.prisma.supplierPaymentInstallment.findMany({
      where: {
        status: { in: ["PLANNED", "OVERDUE"] },
        dueDate: { lte: inThreeDays },
        plan: { obligation: { status: { in: ["OPEN", "PARTIALLY_PAID"] } } },
      },
      include: {
        plan: {
          include: {
            obligation: {
              select: { code: true, bookingCode: true, orderCode: true, supplierCode: true, status: true },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const financeUsers = await this.prisma.user.findMany({
      where: { role: { code: "FINANCE" } },
      select: { id: true },
    });
    if (financeUsers.length === 0) return { created: 0, checked: installments.length, overdue: 0 };

    const contextDate = isoDate(today);
    const notifications: Prisma.UserNotificationCreateManyInput[] = [];
    let overdue = 0;
    for (const installment of installments) {
      const days = Math.round((dateOnly(installment.dueDate).getTime() - today.getTime()) / DAY_MS);
      const isOverdue = days < 0;
      if (isOverdue) overdue++;
      const type = isOverdue ? "SUPPLIER_PAYMENT_OVERDUE" : "SUPPLIER_PAYMENT_DUE";
      const label = isOverdue ? "Просрочена оплата поставщику" : "Напоминание об оплате поставщику";
      const obligation = installment.plan.obligation;
      const title = `${label}: ${obligation.bookingCode ?? obligation.orderCode ?? obligation.code}`;
      const dueLabel = (() => {
        const raw = isoDate(installment.dueDate) ?? "";
        const [y, m, d] = raw.split("-");
        return d && m && y ? `${d}.${m}.${y.slice(-2)}` : raw;
      })();
      const body = [
        `${obligation.supplierCode ?? "Поставщик"}: ${num(installment.amount).toFixed(2)} AZN`,
        `срок ${dueLabel}`,
        isOverdue ? `просрочка ${Math.abs(days)} дн.` : `до оплаты ${days} дн.`,
      ].join(" · ");
      for (const user of financeUsers) {
        notifications.push({
          recipientId: user.id,
          type,
          entityType: "SupplierPaymentInstallment",
          entityId: installment.id,
          title,
          body,
          payload: {
            obligationId: installment.plan.obligationId,
            installmentId: installment.id,
            dueDate: isoDate(installment.dueDate),
            amount: num(installment.amount),
            href: "/app/finance/payment-terms",
          } as Prisma.InputJsonValue,
          dedupeKey: `${installment.id}:${contextDate}:${type}`,
        });
      }
    }

    let created = 0;
    if (notifications.length > 0) {
      const result = await this.prisma.userNotification.createMany({ data: notifications, skipDuplicates: true });
      created = result.count;
    }
    await this.prisma.supplierPaymentInstallment.updateMany({
      where: { id: { in: installments.filter((i) => dateOnly(i.dueDate) < today).map((i) => i.id) }, status: "PLANNED" },
      data: { status: "OVERDUE" },
    });
    return { created, checked: installments.length, overdue };
  }
}
