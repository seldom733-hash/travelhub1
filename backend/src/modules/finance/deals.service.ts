import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type DealQuery = {
  search?: string;
  stage?: string;
  scope?: string;
  state?: string;
  viewerId?: string;
  cancellationReason?: string;
  settlementStatus?: string;
  status?: string;
  statusGroup?: string;
  supplierId?: string;
  country?: string;
  manager?: string;
  clientPayment?: string;
  supplierPayment?: string;
  financialStatus?: string;
  serviceType?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: "createdAt" | "serviceDate" | "financial";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

export function computeDealIncome(input: {
  isCancelledDeal: boolean;
  completed: boolean;
  sales: number;
  cost: number;
  clientReceived: number;
  clientRefunded: number;
  supplierPaid: number;
  supplierRefunded: number;
  clientWriteOff: number;
}) {
  const { isCancelledDeal, completed, sales, cost, clientReceived, clientRefunded, supplierPaid, supplierRefunded, clientWriteOff } = input;
  if (isCancelledDeal) {
    const cancellationResult = (clientReceived - clientRefunded) - (supplierPaid - supplierRefunded);
    return { expectedIncome: 0, currentIncome: 0, cancellationResult, cancellationIncome: Math.max(0, cancellationResult), cancellationLoss: Math.min(0, cancellationResult), writeOffExpense: Math.max(0, clientWriteOff), cancelledSalesAmount: sales, lostIncome: Math.max(0, sales - cost - cancellationResult) };
  }
  if (completed) {
    const recognizedRevenue = sales - clientRefunded;
    const recognizedCost = cost - supplierRefunded;
    return { expectedIncome: 0, currentIncome: recognizedRevenue - recognizedCost - Math.max(0, clientWriteOff), cancellationResult: 0, cancellationIncome: 0, cancellationLoss: 0, writeOffExpense: Math.max(0, clientWriteOff), cancelledSalesAmount: 0, lostIncome: 0 };
  }
  return { expectedIncome: sales - cost, currentIncome: 0, cancellationResult: 0, cancellationIncome: 0, cancellationLoss: 0, writeOffExpense: 0, cancelledSalesAmount: 0, lostIncome: 0 };
}

type DealRow = {
  sequence: string;
  requestId: string;
  requestCode: string;
  orderId: string | null;
  orderCode: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  stage: "REQUEST" | "ORDER" | "BOOKING";
  stageLabel: string;
  status: string;
  orderStatus: string | null;
  statusLabel: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  productId: string | null;
  productType: string | null;
  productTitle: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  manager: string | null;
  managerId: string | null;
  travelerCount: number | null;
  serviceDate: string | null;
  createdAt: string;
  salesAmount: string;
  costAmount: string;
  grossMargin: string;
  settlementStatus: string | null;
  supplierBasePrice: string;
  supplierBaseCurrency: string;
  supplierBasePriceAzn: string;
  channel: string;
  trip: { country: string | null; dateFrom: string | null; dateTo: string | null; nights: number | null; adults: number | null; children: number | null };
  services: Array<{ id: string; title: string; type: string; serviceDate: string | null; clientPrice: string; cost: string; income: string; mediaId: string | null }>;
  markupAmount: string;
  commissionAmount: string;
  clientReceived: string;
  clientDebt: string;
  clientRefunded: string;
  clientRefundPending: string;
  clientRefundTotal: string;
  supplierPaid: string;
  supplierDebt: string;
  supplierRefunded: string;
  supplierRefundDue: string;
  clientPenalty: string;
  supplierPenalty: string;
  expectedIncome: string;
  currentIncome: string;
  cancelledSalesAmount: string;
  lostIncome: string;
  currency: string;
  financialStatus: string;
  paymentStatus: string;
  supplierPaymentStatus: string;
  cancellationReason: string | null;
  isCancelledDeal: boolean;
  cancellationIncome: string;
  cancellationLoss: string;
  writeOffExpense: string;
  cancellationResult: string;
  payments: Array<{ id: string; code: string; amount: string; currency: string; status: string; method: string | null; date: string }>;
  refunds: Array<{ id: string; code: string; amount: string; currency: string; status: string; date: string }>;
  payouts: Array<{ id: string; code: string; amount: string; currency: string; status: string; direction: string; date: string }>;
};

const money = (value: Prisma.Decimal | string | number | null | undefined) => Number(value ?? 0);
const fixed = (value: number) => (Math.round(value * 100) / 100).toFixed(2);
const digits = (value: string) => value.replace(/\D/g, "");
const dateOrNull = (value: Date | null | undefined) => (value ? value.toISOString() : null);

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}


  async history(sequence: string) {
    const request = await this.prisma.request.findFirst({ where: { commerceSequence: sequence }, select: { id: true } });
    const orders = await this.prisma.order.findMany({ where: { commerceSequence: sequence }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    const [bookings, payments, refunds, payouts] = await Promise.all([
      orderIds.length ? this.prisma.booking.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }) : [],
      orderIds.length ? this.prisma.payment.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }) : [],
      orderIds.length ? this.prisma.refund.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }) : [],
      orderIds.length ? this.prisma.supplierPayout.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }) : [],
    ]);
    const bookingIds = bookings.map((b) => b.id);
    const [orderHistory, requestHistory, bookingHistory] = await Promise.all([
      orderIds.length ? this.prisma.orderHistory.findMany({ where: { orderId: { in: orderIds } }, orderBy: { createdAt: "desc" }, take: 500 }) : [],
      request ? this.prisma.requestHistory.findMany({ where: { requestId: request.id }, orderBy: { createdAt: "desc" }, take: 500 }) : [],
      bookingIds.length ? this.prisma.bookingHistory.findMany({ where: { bookingId: { in: bookingIds } }, orderBy: { createdAt: "desc" }, take: 500 }) : [],
    ]);
    const ids = [request?.id, ...orderIds, ...bookingIds, ...payments.map((p) => p.id), ...refunds.map((r) => r.id), ...payouts.map((p) => p.id)].filter((id): id is string => Boolean(id));
    const audit = ids.length ? await this.prisma.auditLog.findMany({ where: { resourceId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 500, include: { user: { select: { username: true } } } }) : [];
    const items = [
      ...audit.map((a) => ({ id: a.id, createdAt: a.createdAt.toISOString(), actorName: a.username ?? a.user?.username ?? "Система", action: a.action, resource: a.resource, resourceId: a.resourceId, details: a.details })),
      ...orderHistory.map((h: any) => ({ id: h.id, createdAt: h.createdAt.toISOString(), actorName: h.actorName ?? "Система", action: h.action, resource: "Order", resourceId: h.orderId, details: h.fields ?? { from: h.from, to: h.to, comment: h.comment } })),
      ...requestHistory.map((h: any) => ({ id: h.id, createdAt: h.createdAt.toISOString(), actorName: h.actorName ?? "Система", action: h.action, resource: "Request", resourceId: h.requestId, details: { from: h.from, to: h.to, comment: h.comment } })),
      ...bookingHistory.map((h: any) => ({ id: h.id, createdAt: h.createdAt.toISOString(), actorName: h.actorName ?? "Система", action: h.action, resource: "Booking", resourceId: h.bookingId, details: h.fields ?? { from: h.from, to: h.to, comment: h.comment } })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { items };
  }

  async list(query: DealQuery) {
    const all = await this.loadRows();
    const filtered = this.filter(all, query);
    const sorted = this.sort(filtered, query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const start = (page - 1) * pageSize;
    const facetRows = all;
    const countries = [...new Set(facetRows.map((row) => row.trip.country).filter((value): value is string => Boolean(value)))].sort();
    const managers = [...new Set(facetRows.map((row) => row.manager).filter((value): value is string => Boolean(value)))].sort();
    const managerUsers = await this.prisma.user.findMany({ where: { status: "ACTIVE", role: { code: "SALES_MANAGER" } }, select: { fullName: true, username: true } });
    for (const user of managerUsers) {
      const name = user.fullName ?? user.username;
      if (!managers.includes(name)) managers.push(name);
    }
    managers.sort((a, b) => a.localeCompare(b));
    const supplierMap = new Map<string, string>();
    for (const row of facetRows) {
      const key = row.supplierId ?? row.supplierCode;
      if (key) supplierMap.set(key, row.supplierCode ?? key);
    }
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
      hasMore: start + pageSize < sorted.length,
      kpi: this.kpi(filtered),
      facets: {
        countries,
        managers,
        suppliers: [...supplierMap.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
      },
    };
  }

  async summary(query: DealQuery) {
    const all = await this.loadRows();
    return this.kpi(this.filter(all, query));
  }

  async exportRows(query: DealQuery) {
    const all = await this.loadRows();
    return this.filter(all, query);
  }

  async bySequence(sequence: string) {
    const all = await this.loadRows();
    const row = all.find((item) => item.sequence === sequence || item.requestCode.toLowerCase() === sequence.toLowerCase() || item.orderCode?.toLowerCase() === sequence.toLowerCase() || item.bookingCode?.toLowerCase() === sequence.toLowerCase());
    return row ?? null;
  }

  private kpi(rows: DealRow[]) {
    const sum = (field: keyof DealRow) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
    const salesRows = rows.filter((row) => row.stage !== "REQUEST");
    const activeRows = salesRows.filter((row) => !row.isCancelledDeal);
    const cancelledRows = salesRows.filter((row) => row.isCancelledDeal);
    const salesAmount = activeRows.reduce((total, row) => total + Number(row.salesAmount), 0);
    const costAmount = activeRows.reduce((total, row) => total + Number(row.costAmount), 0);
    const expectedIncome = activeRows.reduce((total, row) => total + Number(row.expectedIncome ?? 0), 0);
    const currentIncome = activeRows.reduce((total, row) => total + Number(row.currentIncome ?? 0), 0);
    const cancellationIncome = cancelledRows.reduce((total, row) => total + Number(row.cancellationIncome ?? 0), 0);
    const cancellationLoss = cancelledRows.reduce((total, row) => total + Number(row.cancellationLoss ?? 0), 0);
    const writeOffExpense = salesRows.reduce((total, row) => total + Number(row.writeOffExpense ?? 0), 0);
    return {
      salesAmount: fixed(salesAmount),
      costAmount: fixed(costAmount),
      grossMargin: fixed(salesAmount - costAmount),
      clientReceived: fixed(sum("clientReceived")),
      clientDebt: fixed(sum("clientDebt")),
      clientRefunded: fixed(sum("clientRefunded")),
      supplierPaid: fixed(sum("supplierPaid")),
      supplierDebt: fixed(rows.filter((row) => row.stage !== "REQUEST").reduce((total, row) => total + Number(row.supplierDebt ?? 0), 0)),
      supplierRefunded: fixed(sum("supplierRefunded")),
      clientPenalty: fixed(sum("clientPenalty")),
      supplierPenalty: fixed(sum("supplierPenalty")),
      expectedIncome: fixed(expectedIncome),
      currentIncome: fixed(currentIncome),
      cancellationIncome: fixed(cancellationIncome),
      cancellationLoss: fixed(cancellationLoss),
      writeOffExpense: fixed(writeOffExpense),
      cancelledSalesAmount: fixed(cancelledRows.reduce((total, row) => total + Number(row.cancelledSalesAmount), 0)),
      lostIncome: fixed(cancelledRows.reduce((total, row) => total + Number(row.lostIncome), 0)),
      cancelledCount: cancelledRows.length,
      currency: rows[0]?.currency ?? "AZN",
      count: rows.length,
    };
  }

  private filter(rows: DealRow[], query: DealQuery): DealRow[] {
    const search = query.search?.trim().toLowerCase();
    const searchDigits = search ? digits(search) : "";
    const from = query.dateFrom ? new Date(query.dateFrom).getTime() : null;
    const to = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999`).getTime() : null;
    return rows.filter((row) => {
      if (search) {
        const haystack = [
          row.sequence, row.requestCode, row.orderCode ?? "", row.bookingCode ?? "",
          row.customerName, row.customerPhone ?? "", row.customerEmail ?? "",
        ].join(" ").toLowerCase();
        const phoneMatch = searchDigits.length > 0 && digits(row.customerPhone ?? "").includes(searchDigits);
        if (!haystack.includes(search) && !(phoneMatch && searchDigits.length >= 3)) return false;
      }
      if (query.stage && row.stage !== query.stage) return false;
      if (query.status && row.status !== query.status) return false;
      if (query.cancellationReason && row.cancellationReason !== query.cancellationReason) return false;
      if (query.statusGroup === "cancelled" && !["CANCELLED", "CANCELLED_BY_CUSTOMER", "SUPPLIER_REJECTED", "REJECTED"].includes(row.status)) return false;
      if (query.scope === "my" && row.managerId !== query.viewerId) return false;
      if (query.state === "open" && ["CLOSED", "COMPLETED", "FULFILLED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "SUPPLIER_REJECTED", "REJECTED", "UNAVAILABLE"].includes(row.status)) return false;
      if (query.state === "closed" && !["CLOSED", "COMPLETED", "FULFILLED"].includes(row.status)) return false;
      if (query.state === "cancelled" && !["CANCELLED", "CANCELLED_BY_CUSTOMER", "SUPPLIER_REJECTED", "REJECTED", "UNAVAILABLE"].includes(row.status)) return false;
      if (query.supplierId && row.supplierId !== query.supplierId && row.supplierCode !== query.supplierId) return false;
      if (query.country && row.trip.country !== query.country) return false;
      if (query.manager && row.manager !== query.manager) return false;
      if (query.clientPayment && row.paymentStatus !== query.clientPayment) return false;
      if (query.supplierPayment && row.supplierPaymentStatus !== query.supplierPayment) return false;
      if (query.settlementStatus && row.settlementStatus !== query.settlementStatus) return false;
      if (query.financialStatus && row.financialStatus !== query.financialStatus) return false;
      if (query.serviceType && row.productType !== query.serviceType) return false;
      if (from || to) {
        const value = query.dateField === "serviceDate"
          ? row.serviceDate
          : query.dateField === "financial"
            ? row.payments[0]?.date ?? row.refunds[0]?.date ?? row.createdAt
            : row.createdAt;
        if (!value) return false;
        const time = new Date(value).getTime();
        if (from != null && time < from) return false;
        if (to != null && time > to) return false;
      }
      return true;
    });
  }

  private sort(rows: DealRow[], query: DealQuery): DealRow[] {
    const direction = query.sortDirection === "asc" ? 1 : -1;
    const key = (query.sortBy ?? "createdAt") as keyof DealRow;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
      return String(av ?? "").localeCompare(String(bv ?? "")) * direction;
    });
  }

  private async resolveOrder(sequence: string) {
    const order = await this.prisma.order.findFirst({ where: { commerceSequence: sequence }, select: { id: true } });
    if (!order) throw new NotFoundException("Deal has no order yet");
    return order;
  }

  async paymentSchedule(sequence: string) {
    const order = await this.resolveOrder(sequence);
    return this.prisma.orderPaymentSchedule.findMany({ where: { orderId: order.id }, orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }] });
  }

  async createSchedule(sequence: string, input: { stage?: string; dueDate?: string; amount?: number | string; percent?: number; condition?: string; note?: string }) {
    const order = await this.resolveOrder(sequence);
    const stage = input.stage?.trim();
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;
    const amount = Number(input.amount);
    if (!stage || !dueDate || Number.isNaN(dueDate.getTime()) || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("stage, dueDate and positive amount are required");
    }
    const count = await this.prisma.orderPaymentSchedule.count({ where: { orderId: order.id } });
    return this.prisma.orderPaymentSchedule.create({
      data: {
        orderId: order.id,
        stage,
        dueDate,
        amount,
        percent: input.percent == null ? null : Math.trunc(Number(input.percent)),
        condition: input.condition?.trim() || null,
        note: input.note?.trim() || null,
        sortOrder: count,
      },
    });
  }

  async updateSchedule(sequence: string, id: string, input: { status?: string; amount?: number | string; condition?: string }) {
    const order = await this.resolveOrder(sequence);
    const item = await this.prisma.orderPaymentSchedule.findFirst({ where: { id, orderId: order.id } });
    if (!item) throw new NotFoundException("Schedule item not found");
    const allowed = ["PLANNED", "DUE", "PAID", "OVERDUE", "CANCELLED"];
    if (input.status && !allowed.includes(input.status)) throw new BadRequestException("Unknown schedule status");
    return this.prisma.orderPaymentSchedule.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.amount != null ? { amount: Number(input.amount) } : {}),
        ...(input.condition !== undefined ? { condition: input.condition || null } : {}),
      },
    });
  }

  private async loadRows(): Promise<DealRow[]> {
    const requests = await this.prisma.request.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    if (requests.length === 0) return [];
    const orderIds = requests.map((r) => r.convertedOrderId).filter((id): id is string => Boolean(id));
    const orders = await this.prisma.order.findMany({ where: { OR: [{ id: { in: orderIds } }, { commerceSequence: { in: requests.map((r) => r.commerceSequence) } }] }, select: { id: true, code: true, referenceNumber: true, commerceSequence: true, status: true, amount: true, currency: true, cancelledAt: true, returnedToRequestAt: true, paidAmount: true, refundedAmount: true, customerId: true, createdBy: true, financialStatus: true, commercialSnapshot: true, items: { select: { id: true, title: true, type: true, serviceDate: true, amount: true, productId: true } } } });
    const orderBySequence = new Map(orders.map((order) => [order.commerceSequence, order]));
    const resolvedOrderIds = [...new Set([...orderIds, ...orders.map((o) => o.id)])];
    const orderProductIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)).filter((id): id is string => Boolean(id)))];
    const [bookings, payments, refunds, payouts, obligations, settlements, customers, products, supplierWriteOffs, media, clientWriteOffs] = await Promise.all([
      this.prisma.booking.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, referenceNumber: true, orderId: true, status: true, amount: true, currency: true } }),
      this.prisma.payment.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, amount: true, currency: true, status: true, paymentMethod: true, paidAt: true, createdAt: true, orderId: true } }),
      this.prisma.refund.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, amount: true, currency: true, status: true, processedAt: true, createdAt: true, orderId: true } }),
      this.prisma.supplierPayout.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, amount: true, currency: true, status: true, direction: true, occurredAt: true, orderId: true, supplierCode: true, partnerId: true } }),
      this.prisma.supplierObligation.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { orderId: true, aznAmount: true, remainingAmount: true } }),
      this.prisma.orderFinancialSettlement.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { orderId: true, status: true, penaltyAmount: true, clientPenaltyAmount: true, clientPenaltyStatus: true, supplierPenaltyStatus: true, supplierPenaltyShare: true, remainingToPay: true, remainingToRefund: true, cancellationReason: true, supplierPenaltyAmount: true, cancellationResult: true, finalCustomerLiability: true } }),
      this.prisma.customer.findMany({ where: { id: { in: requests.map((r) => r.customerId).filter((id): id is string => Boolean(id)) } }, select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true } }),
      this.prisma.product.findMany({ where: { id: { in: requests.map((r) => r.productId).filter((id): id is string => Boolean(id)) } }, select: { id: true, title: true, type: true, partnerId: true, attributes: true } }),
      this.prisma.supplierDebtWriteOff.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { orderId: true, amount: true } }),
      orderProductIds.length ? this.prisma.productMedia.findMany({ where: { productId: { in: orderProductIds }, isPrimary: true, status: "PUBLISHED" }, select: { id: true, productId: true } }) : [],
      this.prisma.clientDebtWriteOff.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { orderId: true, amount: true } }),
    ]);
    const partnerIds = [...new Set([
      ...requests.map((r) => r.partnerId).filter((id): id is string => Boolean(id)),
      ...products.map((p) => p.partnerId).filter((id): id is string => Boolean(id)),
      ...payouts.map((p) => p.partnerId).filter((id): id is string => Boolean(id)),
    ])];
    const supplierCodes = [...new Set(payouts.map((p) => p.supplierCode).filter((code): code is string => Boolean(code)))];
    const partners = partnerIds.length > 0 || supplierCodes.length > 0
      ? await this.prisma.partner.findMany({ where: { OR: [{ id: { in: partnerIds } }, { code: { in: supplierCodes } }] }, select: { id: true, code: true, name: true } })
      : [];
    const byOrder = <T extends { orderId: string | null }>(items: T[]) => {
      const map = new Map<string, T[]>();
      for (const item of items) {
        if (!item.orderId) continue;
        const list = map.get(item.orderId) ?? [];
        list.push(item);
        map.set(item.orderId, list);
      }
      return map;
    };
    const bookingByOrder = new Map(bookings.map((b) => [b.orderId, b]));
    const paymentsByOrder = byOrder(payments);
    const refundsByOrder = byOrder(refunds);
    const payoutsByOrder = byOrder(payouts);
    const obligationsByOrder = byOrder(obligations);
    const settlementByOrder = new Map(settlements.map((s) => [s.orderId, s]));
    const customerById = new Map(customers.map((c) => [c.id, c]));
    const productById = new Map(products.map((p) => [p.id, p]));
    const partnerById = new Map(partners.map((p) => [p.id, p]));
    const mediaByProduct = new Map(media.map((m) => [m.productId, m.id]));
    const partnerByCode = new Map(partners.map((p) => [p.code, p]));
    const managerIds = [...new Set(requests.map((r) => r.assignedManagerId).filter((id): id is string => Boolean(id)))];
    const managers = managerIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, fullName: true, username: true } })
      : [];
    const managerById = new Map(managers.map((m) => [m.id, m]));

    return requests.map((request) => {
      const order = request.convertedOrderId ? orders.find((o) => o.id === request.convertedOrderId) : orderBySequence.get(request.commerceSequence);
      const booking = order ? bookingByOrder.get(order.id) : undefined;
      const customer = request.customerId ? customerById.get(request.customerId) : undefined;
      const product = request.productId ? productById.get(request.productId) : undefined;
      const snapshot = (request.productSnapshot ?? {}) as Record<string, unknown>;
      const snapCustomer = (snapshot.customer ?? {}) as Record<string, unknown>;
      const snapOffer = (snapshot.offer ?? {}) as Record<string, unknown>;
      const commercial = (order?.commercialSnapshot ?? request.commercialSnapshot ?? {}) as Record<string, unknown>;
      const clientPayments = order ? paymentsByOrder.get(order.id) ?? [] : [];
      const clientRefundRows = order ? refundsByOrder.get(order.id) ?? [] : [];
      const clientRefunds = clientRefundRows.filter((r) => r.status === "PROCESSED");
      const supplierPayouts = order ? payoutsByOrder.get(order.id) ?? [] : [];
      const supplierObligations = order ? obligationsByOrder.get(order.id) ?? [] : [];
      const supplierWriteOff = supplierWriteOffs.filter((w) => w.orderId === order?.id).reduce((sum, w) => sum + money(w.amount), 0);
      const settlement = order ? settlementByOrder.get(order.id) : undefined;
      const captured = clientPayments.filter((p) => p.status === "CAPTURED" || p.status === "REFUNDED").reduce((sum, p) => sum + money(p.amount), 0);
      const refunded = clientRefunds.filter((r) => r.status !== "FAILED").reduce((sum, r) => sum + money(r.amount), 0);
      const refundedTotal = clientRefundRows.filter((r) => r.status !== "FAILED").reduce((sum, r) => sum + money(r.amount), 0);
      const supplierPaid = supplierPayouts.filter((p) => p.direction !== "INCOMING" && p.status === "CONFIRMED").reduce((sum, p) => sum + money(p.amount), 0);
      const supplierRefunded = supplierPayouts.filter((p) => p.direction === "INCOMING" && p.status === "CONFIRMED").reduce((sum, p) => sum + money(p.amount), 0);
      const sales = order ? money(order.amount) : money(request.confirmedPrice ?? request.displayedPrice);
      const fx = commercial.fx as Record<string, unknown> | undefined;
      const supplierPrice = money(commercial.supplierPrice as number | string | undefined);
      const costFromSnapshot = money((commercial.netSupplierCost as number | string | undefined) ?? (fx?.aznAmount as number | string | undefined) ?? supplierPrice);
      const productAttributes = (product?.attributes ?? {}) as Record<string, unknown>;
      const costFromProduct = money(
        (productAttributes.priceLocal as number | string | undefined)
          ?? (productAttributes.convertedPrice as number | string | undefined)
          ?? (productAttributes.startingPrice as number | string | undefined)
          ?? 0,
      );
      const obligationCost = supplierObligations.reduce((sum, o) => sum + money(o.aznAmount), 0);
      const obligationDebt = supplierObligations.reduce((sum, o) => sum + money(o.remainingAmount), 0);
      // A supplier obligation equal to the customer sale is a legacy/demo
      // projection (auto-created from booking amount), not a cost. Use the
      // product's supplier price in that case.
      const useObligationCost = obligationCost > 0 && obligationCost < sales;
      const cost = useObligationCost
        ? obligationCost
        : costFromSnapshot || costFromProduct;
      const returnedToRequest = order?.status === "CANCELLED" && request.status !== "CONVERTED" && !["CANCELLED_BY_CUSTOMER", "REJECTED", "UNAVAILABLE", "EXPIRED"].includes(request.status);
      const activeBooking = booking && booking.status !== "CANCELLED" ? booking : null;
      const stage = returnedToRequest ? "REQUEST" : activeBooking ? "BOOKING" : order ? "ORDER" : "REQUEST";
      const status = returnedToRequest ? request.status : activeBooking?.status ?? order?.status ?? request.status;
      const cancelled = ["CANCELLED", "CANCELLED_BY_CUSTOMER", "SUPPLIER_REJECTED"].includes(status);
      const rawSupplierDebt = order?.status === "CANCELLED"
        ? Math.max(0, supplierPaid - supplierRefunded)
        : cost > 0
          ? Math.max(0, cost - supplierPaid + supplierRefunded)
          : obligationDebt;
      const supplierDebt = Math.max(0, rawSupplierDebt - supplierWriteOff);
      const cancelledOrder = cancelled || Boolean(order?.cancelledAt);
      const clientWriteOff = clientWriteOffs.filter((w) => w.orderId === order?.id).reduce((sum, w) => sum + money(w.amount), 0);
      const clientDebt = cancelledOrder ? 0 : settlement
        ? Math.max(0, money(settlement.remainingToPay) - clientWriteOff)
        : Math.max(0, sales - captured + refundedTotal - clientWriteOff);
      const clientPenalty = ["CONFIRMED", "WITHHELD", "RECEIVED"].includes(settlement?.clientPenaltyStatus ?? "")
        ? money(settlement?.clientPenaltyAmount)
        : 0;
      const supplierPenalty = ["CONFIRMED", "WITHHELD", "RECEIVED"].includes(settlement?.supplierPenaltyStatus ?? "")
        ? money(settlement?.supplierPenaltyShare)
        : 0;
      const isCancelledDeal = cancelled || Boolean(order?.cancelledAt && !order?.returnedToRequestAt);
      const completed = ["FULFILLED", "CLOSED"].includes(order?.status ?? "") || status === "COMPLETED";
      const income = computeDealIncome({
        isCancelledDeal,
        completed,
        sales,
        cost,
        clientReceived: captured,
        clientRefunded: refunded,
        supplierPaid,
        supplierRefunded,
        clientWriteOff,
      });
      const expectedIncome = income.expectedIncome;
      const currentIncome = income.currentIncome;
      const cancelledSalesAmount = income.cancelledSalesAmount;
      const lostIncome = income.lostIncome;
      const attrs = productAttributes;
      const nights = Number(attrs.nights ?? snapOffer.nights ?? 0) || null;
      const country = request.tripCountry ?? (typeof attrs.country === "string" ? attrs.country : typeof snapOffer.country === "string" ? snapOffer.country : null);
      const dateFrom = request.requestedServiceDate ? request.requestedServiceDate.toISOString() : null;
      const dateTo = dateFrom && nights ? new Date(new Date(dateFrom).getTime() + nights * 86400000).toISOString() : null;
      const adults = Number(attrs.adults ?? 0) || null;
      const children = Number(attrs.children ?? 0) || null;
      const channel = request.sourceChannel ?? (commercial.priceSource === "PUBLIC" ? "Сайт (универсальный поиск)" : String(commercial.priceSource ?? "Ручное создание"));
      const itemRows = order?.items ?? [];
      const services = itemRows.length > 0
        ? itemRows.map((item) => {
            const itemAmount = money(item.amount);
            const itemCost = sales > 0 ? cost * (itemAmount / sales) : 0;
            return { id: item.id, title: item.title, type: item.type, serviceDate: item.serviceDate ? item.serviceDate.toISOString() : null, clientPrice: fixed(itemAmount), cost: fixed(itemCost), income: fixed(itemAmount - itemCost), mediaId: mediaByProduct.get(item.productId ?? "") ?? null };
          })
        : [{ id: request.id, title: String(snapshot.productTitle ?? product?.title ?? "—"), type: String(snapshot.type ?? product?.type ?? "—"), serviceDate: dateFrom, clientPrice: fixed(sales), cost: fixed(cost), income: fixed(expectedIncome), mediaId: null }];
      return {
        sequence: request.commerceSequence,
        requestId: request.id,
        requestCode: request.referenceNumber,
        orderId: order?.id ?? null,
        orderCode: order?.referenceNumber ?? null,
        bookingId: booking?.id ?? null,
        bookingCode: booking?.referenceNumber ?? null,
        stage,
        stageLabel: cancelled ? "Отменена" : stage === "BOOKING" ? "Бронь" : stage === "ORDER" ? "Заказ" : "Заявка",
        status,
        orderStatus: order?.status ?? null,
        statusLabel: status,
        customerId: customer?.id ?? null,
        customerName: customer
          ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.companyName || "—"
          : [String(snapCustomer.firstName ?? ""), String(snapCustomer.lastName ?? "")].filter(Boolean).join(" ") || "—",
        customerPhone: customer?.phone ?? (typeof snapCustomer.phone === "string" ? snapCustomer.phone : null),
        customerEmail: customer?.email ?? (typeof snapCustomer.email === "string" ? snapCustomer.email : null),
        productId: request.productId,
        productType: String(snapshot.productType ?? product?.type ?? ""),
        productTitle: String(snapshot.productTitle ?? product?.title ?? "—"),
        supplierId: product?.partnerId ?? request.partnerId ?? null,
        supplierName: partnerById.get(product?.partnerId ?? request.partnerId ?? "")?.name ?? null,
        supplierCode: typeof snapshot.supplierCode === "string"
          ? snapshot.supplierCode
          : typeof snapOffer.supplierCode === "string"
            ? snapOffer.supplierCode
            : partnerById.get(product?.partnerId ?? request.partnerId ?? "")?.code
              ?? partnerById.get(product?.partnerId ?? request.partnerId ?? "")?.name
              ?? request.partnerId
              ?? null,
        managerId: request.assignedManagerId ?? null,
        manager: (request.assignedManagerId ? (managerById.get(request.assignedManagerId)?.fullName ?? managerById.get(request.assignedManagerId)?.username) : null) ?? order?.createdBy ?? null,
        travelerCount: request.travelerCount ?? null,
        serviceDate: dateOrNull(request.requestedServiceDate),
        createdAt: request.createdAt.toISOString(),
        salesAmount: fixed(sales),
        costAmount: fixed(cost),
        grossMargin: fixed(sales - cost),
        settlementStatus: settlement?.status ?? null,
        supplierBasePrice: fixed(money(commercial.supplierPrice as number | string | undefined) || cost),
        supplierBaseCurrency: String(commercial.supplierCurrency ?? order?.currency ?? request.confirmedCurrency ?? "AZN"),
        supplierBasePriceAzn: fixed(money(fx?.aznAmount as number | string | undefined) || cost),
        channel,
        trip: { country, dateFrom, dateTo, nights, adults, children },
        services,
        markupAmount: fixed(money(commercial.markupAmount as number | string | undefined)),
        commissionAmount: fixed(money(commercial.commissionAmount as number | string | undefined)),
        clientReceived: fixed(captured),
        clientDebt: fixed(clientDebt),
        clientRefunded: fixed(refunded),
        clientRefundPending: fixed(clientRefundRows.filter((r) => ["REQUESTED", "APPROVED"].includes(r.status)).reduce((sum, r) => sum + money(r.amount), 0)),
        clientRefundTotal: fixed(refundedTotal),
        supplierPaid: fixed(supplierPaid),
        supplierDebt: fixed(supplierDebt),
        supplierRefunded: fixed(supplierRefunded),
        supplierRefundDue: fixed(cancelled ? Math.max(0, supplierPaid - supplierRefunded) : 0),
        clientPenalty: fixed(Number(clientPenalty)),
        supplierPenalty: fixed(Number(supplierPenalty)),
        expectedIncome: fixed(expectedIncome),
        currentIncome: fixed(currentIncome),
        cancelledSalesAmount: fixed(cancelledSalesAmount),
        lostIncome: fixed(lostIncome),
        currency: order?.currency ?? request.confirmedCurrency ?? request.displayedCurrency ?? "AZN",
        financialStatus: settlement?.status ?? order?.financialStatus ?? "OPEN",
        paymentStatus: captured <= 0 ? "UNPAID" : captured >= sales ? "PAID" : "PARTIALLY_PAID",
        supplierPaymentStatus: supplierPaid <= 0 ? "UNPAID" : supplierPaid >= cost ? "PAID" : "PARTIALLY_PAID",
        cancellationReason: settlement?.cancellationReason ?? null,
        cancellationResult: String(settlement?.cancellationResult ?? 0),
        isCancelledDeal,
        cancellationIncome: fixed(income.cancellationIncome),
        cancellationLoss: fixed(income.cancellationLoss),
        writeOffExpense: fixed(income.writeOffExpense),
        payments: clientPayments.map((p) => ({ id: p.id, code: p.code, amount: p.amount.toString(), currency: p.currency, status: p.status, method: p.paymentMethod, date: (p.paidAt ?? p.createdAt).toISOString() })),
        refunds: clientRefundRows.map((r) => ({ id: r.id, code: r.code, amount: r.amount.toString(), currency: r.currency, status: r.status, date: (r.processedAt ?? r.createdAt).toISOString() })),
        payouts: supplierPayouts.map((p) => ({ id: p.id, code: p.code, amount: p.amount.toString(), currency: p.currency, status: p.status, direction: p.direction, date: p.occurredAt.toISOString(), supplierCode: p.supplierCode ?? p.partnerId ?? null, supplierName: (p.partnerId ? partnerById.get(p.partnerId)?.name : null) ?? (p.supplierCode ? partnerByCode.get(p.supplierCode)?.name : null) ?? p.supplierCode ?? p.partnerId ?? null })),
      };
    });
  }
}
