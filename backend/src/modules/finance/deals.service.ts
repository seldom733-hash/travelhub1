import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type DealQuery = {
  search?: string;
  stage?: string;
  status?: string;
  supplierId?: string;
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
  manager: string | null;
  travelerCount: number | null;
  serviceDate: string | null;
  createdAt: string;
  salesAmount: string;
  costAmount: string;
  clientReceived: string;
  clientDebt: string;
  clientRefunded: string;
  supplierPaid: string;
  supplierDebt: string;
  supplierRefunded: string;
  clientPenalty: string;
  supplierPenalty: string;
  expectedIncome: string;
  currentIncome: string;
  currency: string;
  financialStatus: string;
  paymentStatus: string;
  supplierPaymentStatus: string;
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

  async list(query: DealQuery) {
    const all = await this.loadRows();
    const filtered = this.filter(all, query);
    const sorted = this.sort(filtered, query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
      hasMore: start + pageSize < sorted.length,
      kpi: this.kpi(filtered),
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
    return {
      salesAmount: fixed(sum("salesAmount")),
      costAmount: fixed(sum("costAmount")),
      clientReceived: fixed(sum("clientReceived")),
      clientDebt: fixed(sum("clientDebt")),
      clientRefunded: fixed(sum("clientRefunded")),
      supplierPaid: fixed(sum("supplierPaid")),
      supplierDebt: fixed(sum("supplierDebt")),
      supplierRefunded: fixed(sum("supplierRefunded")),
      clientPenalty: fixed(sum("clientPenalty")),
      supplierPenalty: fixed(sum("supplierPenalty")),
      expectedIncome: fixed(sum("expectedIncome")),
      currentIncome: fixed(sum("currentIncome")),
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
      if (query.supplierId && row.supplierId !== query.supplierId) return false;
      if (query.manager && row.manager !== query.manager) return false;
      if (query.clientPayment && row.paymentStatus !== query.clientPayment) return false;
      if (query.supplierPayment && row.supplierPaymentStatus !== query.supplierPayment) return false;
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

  private async loadRows(): Promise<DealRow[]> {
    const requests = await this.prisma.request.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    if (requests.length === 0) return [];
    const orderIds = requests.map((r) => r.convertedOrderId).filter((id): id is string => Boolean(id));
    const orders = await this.prisma.order.findMany({ where: { OR: [{ id: { in: orderIds } }, { commerceSequence: { in: requests.map((r) => r.commerceSequence) } }] }, select: { id: true, code: true, referenceNumber: true, commerceSequence: true, status: true, amount: true, currency: true, paidAmount: true, refundedAmount: true, customerId: true, createdBy: true, financialStatus: true, commercialSnapshot: true } });
    const orderBySequence = new Map(orders.map((order) => [order.commerceSequence, order]));
    const resolvedOrderIds = [...new Set([...orderIds, ...orders.map((o) => o.id)])];
    const [bookings, payments, refunds, payouts, obligations, settlements, customers, products] = await Promise.all([
      this.prisma.booking.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, referenceNumber: true, orderId: true, status: true, amount: true, currency: true } }),
      this.prisma.payment.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, amount: true, currency: true, status: true, paymentMethod: true, paidAt: true, createdAt: true, orderId: true } }),
      this.prisma.refund.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, amount: true, currency: true, status: true, processedAt: true, createdAt: true, orderId: true } }),
      this.prisma.supplierPayout.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { id: true, code: true, amount: true, currency: true, status: true, direction: true, occurredAt: true, orderId: true } }),
      this.prisma.supplierObligation.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { orderId: true, aznAmount: true, remainingAmount: true } }),
      this.prisma.orderFinancialSettlement.findMany({ where: { orderId: { in: resolvedOrderIds } }, select: { orderId: true, status: true, penaltyAmount: true, supplierPenaltyShare: true, remainingToPay: true, remainingToRefund: true, finalCustomerLiability: true } }),
      this.prisma.customer.findMany({ where: { id: { in: requests.map((r) => r.customerId).filter((id): id is string => Boolean(id)) } }, select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true } }),
      this.prisma.product.findMany({ where: { id: { in: requests.map((r) => r.productId).filter((id): id is string => Boolean(id)) } }, select: { id: true, title: true, type: true, partnerId: true } }),
    ]);
    const partnerIds = [...new Set([
      ...requests.map((r) => r.partnerId).filter((id): id is string => Boolean(id)),
      ...products.map((p) => p.partnerId).filter((id): id is string => Boolean(id)),
    ])];
    const partners = partnerIds.length > 0
      ? await this.prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, code: true, name: true } })
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

    return requests.map((request) => {
      const order = request.convertedOrderId ? orders.find((o) => o.id === request.convertedOrderId) : orderBySequence.get(request.commerceSequence);
      const booking = order ? bookingByOrder.get(order.id) : undefined;
      const customer = request.customerId ? customerById.get(request.customerId) : undefined;
      const product = request.productId ? productById.get(request.productId) : undefined;
      const snapshot = (request.productSnapshot ?? {}) as Record<string, unknown>;
      const commercial = (order?.commercialSnapshot ?? request.commercialSnapshot ?? {}) as Record<string, unknown>;
      const clientPayments = order ? paymentsByOrder.get(order.id) ?? [] : [];
      const clientRefunds = order ? refundsByOrder.get(order.id) ?? [] : [];
      const supplierPayouts = order ? payoutsByOrder.get(order.id) ?? [] : [];
      const supplierObligations = order ? obligationsByOrder.get(order.id) ?? [] : [];
      const settlement = order ? settlementByOrder.get(order.id) : undefined;
      const captured = clientPayments.filter((p) => p.status === "CAPTURED" || p.status === "REFUNDED").reduce((sum, p) => sum + money(p.amount), 0);
      const refunded = clientRefunds.filter((r) => r.status === "PROCESSED").reduce((sum, r) => sum + money(r.amount), 0);
      const supplierPaid = supplierPayouts.filter((p) => p.direction !== "INCOMING" && p.status === "CONFIRMED").reduce((sum, p) => sum + money(p.amount), 0);
      const supplierRefunded = supplierPayouts.filter((p) => p.direction === "INCOMING" && p.status === "CONFIRMED").reduce((sum, p) => sum + money(p.amount), 0);
      const sales = order ? money(order.amount) : money(request.confirmedPrice ?? request.displayedPrice);
      const fx = commercial.fx as Record<string, unknown> | undefined;
      const supplierPrice = money(commercial.supplierPrice as number | string | undefined);
      const costFromSnapshot = supplierPrice > 0 ? money((fx?.aznAmount as number | string | undefined) ?? supplierPrice) : 0;
      const cost = supplierObligations.reduce((sum, o) => sum + money(o.aznAmount), 0) || costFromSnapshot;
      const clientDebt = settlement
        ? money(settlement.remainingToPay)
        : order?.status === "CANCELLED" ? 0 : Math.max(0, sales - captured);
      const supplierDebt = supplierObligations.reduce((sum, o) => sum + money(o.remainingAmount), 0) || Math.max(0, cost - supplierPaid + supplierRefunded);
      const clientPenalty = money(settlement?.penaltyAmount);
      const supplierPenalty = money(settlement?.supplierPenaltyShare);
      const stage = booking ? "BOOKING" : order ? "ORDER" : "REQUEST";
      const status = booking?.status ?? order?.status ?? request.status;
      return {
        sequence: request.commerceSequence,
        requestId: request.id,
        requestCode: request.referenceNumber,
        orderId: order?.id ?? null,
        orderCode: order?.referenceNumber ?? null,
        bookingId: booking?.id ?? null,
        bookingCode: booking?.referenceNumber ?? null,
        stage,
        stageLabel: stage === "BOOKING" ? "Бронь" : stage === "ORDER" ? "Заказ" : "Заявка",
        status,
        statusLabel: status,
        customerId: customer?.id ?? null,
        customerName: customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.companyName || "—" : "—",
        customerPhone: customer?.phone ?? null,
        customerEmail: customer?.email ?? null,
        productId: request.productId,
        productType: String(snapshot.productType ?? product?.type ?? ""),
        productTitle: String(snapshot.productTitle ?? product?.title ?? "—"),
        supplierId: product?.partnerId ?? request.partnerId ?? null,
        supplierCode: partnerById.get(product?.partnerId ?? request.partnerId ?? "")?.code
          ?? partnerById.get(product?.partnerId ?? request.partnerId ?? "")?.name
          ?? request.partnerId ?? null,
        manager: order?.createdBy ?? null,
        travelerCount: request.travelerCount ?? null,
        serviceDate: dateOrNull(request.requestedServiceDate),
        createdAt: request.createdAt.toISOString(),
        salesAmount: fixed(sales),
        costAmount: fixed(cost),
        clientReceived: fixed(captured),
        clientDebt: fixed(clientDebt),
        clientRefunded: fixed(refunded),
        supplierPaid: fixed(supplierPaid),
        supplierDebt: fixed(supplierDebt),
        supplierRefunded: fixed(supplierRefunded),
        clientPenalty: fixed(clientPenalty),
        supplierPenalty: fixed(supplierPenalty),
        expectedIncome: fixed(sales - cost),
        currentIncome: settlement
          ? fixed(Math.max(0, money(settlement.finalCustomerLiability) - supplierPaid + supplierRefunded))
          : fixed(Math.max(0, captured - refunded - supplierPaid + supplierRefunded)),
        currency: order?.currency ?? request.confirmedCurrency ?? request.displayedCurrency ?? "AZN",
        financialStatus: settlement?.status ?? order?.financialStatus ?? "OPEN",
        paymentStatus: captured <= 0 ? "UNPAID" : captured >= sales ? "PAID" : "PARTIALLY_PAID",
        supplierPaymentStatus: supplierPaid <= 0 ? "UNPAID" : supplierPaid >= cost ? "PAID" : "PARTIALLY_PAID",
        payments: clientPayments.map((p) => ({ id: p.id, code: p.code, amount: p.amount.toString(), currency: p.currency, status: p.status, method: p.paymentMethod, date: (p.paidAt ?? p.createdAt).toISOString() })),
        refunds: clientRefunds.map((r) => ({ id: r.id, code: r.code, amount: r.amount.toString(), currency: r.currency, status: r.status, date: (r.processedAt ?? r.createdAt).toISOString() })),
        payouts: supplierPayouts.map((p) => ({ id: p.id, code: p.code, amount: p.amount.toString(), currency: p.currency, status: p.status, direction: p.direction, date: p.occurredAt.toISOString() })),
      };
    });
  }
}
