import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../security.service";
import { CrmService } from "../../modules/crm/crm.service";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { normalizeEmail } from "../../shared/field-validation";
import { isoOrNull, isoUtc } from "../../shared/temporal";

export interface UpdateOwnProfileInput {
  fullName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/* ── Buyer Cabinet read-model contracts (Step 1.13) ─────────────────────────── */

export interface OwnOrderItem {
  id: string;
  title: string;
  productCode: string;
  quantity: number;
  price: string;
  amount: string;
  serviceDate: string | null;
}

export interface OwnOrder {
  id: string;
  code: string;
  number: string;
  status: string;
  paymentStatus: string;
  currency: string;
  amount: string;
  /** Canonical service date (если есть), иначе null. НЕ updatedAt (§13). */
  serviceDate: string | null;
  /** Step 2.8A: local wall-clock (HH:mm) + frozen IANA zone (authorized facts). */
  serviceTime: string | null;
  serviceTimeZone: string | null;
  /** Canonical Order.createdAt — момент создания, НЕ «дата заказа» (§13). */
  createdAt: string;
  items: OwnOrderItem[];
}

export interface OwnOrdersResult {
  items: OwnOrder[];
  total: number;
  page: number;
  pageSize: number;
  /** true, если после текущей страницы есть ещё records (анти-silent truncation, §8). */
  hasMore: boolean;
}

export interface OwnBooking {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  /** Валюта связанного Order (у Booking нет собственной валюты) — authoritative. */
  currency: string;
  status: string;
  amount: string;
  serviceDate: string | null;
  /** Step 2.8A: local wall-clock + zone (authorized; PII-free). */
  serviceTime: string | null;
  serviceTimeZone: string | null;
  /** Derived UTC start instant (TIME_SLOT) — authorized serialization §26. */
  serviceStartsAt: string | null;
  createdAt: string;
}

export interface OwnBookingsResult {
  items: OwnBooking[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Controlled empty contract для разделов, чей canonical domain ещё не существует
 * (Payments/Documents/Support — Phase 2/3). Никаких fake records — только
 * честный empty-state сигнал (`available: false`).
 */
export interface BuyerEmptySectionResult {
  items: never[];
  total: 0;
  /** false — authoritative данные/домен ещё не реализованы. */
  available: false;
}

export interface OwnProfileResult {
  user: {
    id: string;
    code: string;
    username: string;
    email: string | null;
    fullName: string | null;
    status: string;
    role: string;
    roleTitle: string;
    customerId: string | null;
  };
  customer: {
    id: string;
    code: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  } | null;
}

/**
 * PHASE 1 STEP 1.9 — own-scope account/profile (identity foundation, НЕ Buyer Cabinet).
 *
 * Ownership:
 *  - security/Users владеет identity-полями (username/email/fullName/role/status);
 *  - crm.Customer — владелец бизнес-полей (firstName/lastName/phone) через CRM-owned
 *    contract (CrmService) — здесь нет прямых Prisma write в crm.*;
 *  - own-scope гарантируется actor context (userId из JWT), userId/partnerId/
 *    customerId/role/… клиент передать не может (forbidden-keys + DTO whitelist);
 *  - sync policy: User.fullName — display projection; при изменении Customer
 *    firstName/lastName проекция обновляется ОДНИМ command (без двух SSOT).
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly crm: CrmService,
  ) {}

  async getProfile(userId: string): Promise<OwnProfileResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new NotFoundError(`User ${userId} not found`);

    let customer: OwnProfileResult["customer"] = null;
    if (user.customerId) {
      const c = await this.prisma.customer.findUnique({ where: { id: user.customerId } });
      if (c) {
        customer = {
          id: c.id,
          code: c.code,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
        };
      }
    }

    return {
      user: {
        id: user.id,
        code: user.code,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        role: user.role.code,
        roleTitle: user.role.title,
        customerId: user.customerId,
      },
      customer,
    };
  }

  /* ── Buyer Cabinet own-scope read-models (Step 1.13) ────────────────────────
   *
   * Кабинет НЕ владеет Order/Booking/Finance: здесь только read-only проекции по
   * доказанной Buyer linkage. Объектный scope ВСЕГДА из actor.customerId (JWT),
   * клиент не может передать/подменить customerId — query/body игнорируются.
   */

  /** Own-scope заказы (§7): Order.customerId == actor.customerId. Пагинация §8. */
  async getOwnOrders(userId: string, page = 1, pageSize = 20): Promise<OwnOrdersResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    if (!user?.customerId) return { items: [], total: 0, page, pageSize, hasMore: false };

    const where = { customerId: user.customerId };
    const total = await this.prisma.order.count({ where });
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: orders.map((o) => ({
        id: o.id,
        code: o.code,
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        currency: o.currency,
        amount: o.amount.toString(),
        serviceDate: isoOrNull(o.serviceDate),
        serviceTime: o.serviceTime ?? null,
        serviceTimeZone: o.serviceTimeZone ?? null,
        createdAt: isoUtc(o.createdAt),
        items: o.items.map((i) => ({
          id: i.id,
          title: i.title,
          productCode: i.productCode,
          quantity: i.quantity,
          price: i.price.toString(),
          amount: i.amount.toString(),
          // OrderItem не имеет собственных temporal-колонок — order-level
          // факты (serviceTime/serviceTimeZone) отдаются на уровне Order.
          serviceDate: isoOrNull(i.serviceDate),
        })),
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /** Own-scope бронирования (§8): Booking.orderId → Order.customerId == actor.customerId. Пагинация §8. */
  async getOwnBookings(userId: string, page = 1, pageSize = 20): Promise<OwnBookingsResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    if (!user?.customerId) return { items: [], total: 0, page, pageSize, hasMore: false };

    // Сначала заказы покупателя (доказанная связь), затем их бронирования.
    const orders = await this.prisma.order.findMany({
      where: { customerId: user.customerId },
      select: { id: true, code: true, referenceNumber: true, currency: true },
    });
    if (orders.length === 0) return { items: [], total: 0, page, pageSize, hasMore: false };

    const orderIds = orders.map((o) => o.id);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const where = { orderId: { in: orderIds } };
    const total = await this.prisma.booking.count({ where });
    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: bookings.map((b) => ({
        id: b.id,
        code: b.code,
        orderId: b.orderId,
        orderCode: orderById.get(b.orderId)?.referenceNumber ?? "",
        currency: orderById.get(b.orderId)?.currency ?? "USD",
        status: b.status,
        amount: b.amount.toString(),
        serviceDate: isoOrNull(b.serviceDate),
        serviceTime: b.serviceTime ?? null,
        serviceTimeZone: b.serviceTimeZone ?? null,
        serviceStartsAt: isoOrNull(b.serviceStartsAt),
        createdAt: isoUtc(b.createdAt),
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /** Own-scope платежи (§9): controlled empty — Finance domain ещё не существует. */
  getOwnPayments(): BuyerEmptySectionResult {
    return { items: [], total: 0, available: false };
  }

  /** Own-scope документы (§10): controlled empty — Documents domain ещё не существует. */
  getOwnDocuments(): BuyerEmptySectionResult {
    return { items: [], total: 0, available: false };
  }

  /** Own-scope поддержка (§11): controlled empty — Support domain ещё не существует. */
  getOwnSupport(): BuyerEmptySectionResult {
    return { items: [], total: 0, available: false };
  }

  /** Обновление ТОЛЬКО собственного профиля (userId из JWT). */
  async updateProfile(userId: string, input: UpdateOwnProfileInput): Promise<OwnProfileResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);

    // ── Identity (security-owned) ──────────────────────────────────────────
    const identity: { fullName?: string; email?: string } = {};
    if (input.fullName !== undefined) identity.fullName = input.fullName;
    let newEmail: string | undefined;
    if (input.email !== undefined) {
      const email = normalizeEmail(input.email);
      const dup = await this.prisma.user.findUnique({ where: { email } });
      if (dup && dup.id !== userId) throw new ConflictError("Email already registered");
      identity.email = email;
      newEmail = email;
    }
    if (Object.keys(identity).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { ...identity, version: { increment: 1 } },
      });
      await this.security.audit(undefined, {
        userId,
        username: user.username,
        action: "account.profile_updated",
        resource: "User",
        resourceId: userId,
        details: { fields: Object.keys(identity) },
      });
    }

    // ── Business fields (CRM-owned contract) ───────────────────────────────
    if (user.customerId) {
      const current = await this.prisma.customer.findUnique({ where: { id: user.customerId } });
      if (!current) throw new NotFoundError(`Customer ${user.customerId} not found`);

      const business: { firstName?: string; lastName?: string; phone?: string } = {};
      if (input.firstName !== undefined) business.firstName = input.firstName;
      if (input.lastName !== undefined) business.lastName = input.lastName;
      if (input.phone !== undefined) business.phone = input.phone;
      if (Object.keys(business).length > 0) {
        await this.crm.updateCustomer(user.customerId, business, userId);
      }
      // Sync policy: User.fullName — display projection от бизнес-имени (ОДИН
      // command, без двух независимых SSOT). Эффективные значения берутся из
      // Customer (текущие + новые), а не из пустых строк.
      const effectiveFirstName = input.firstName !== undefined ? input.firstName : (current.firstName ?? "");
      const effectiveLastName = input.lastName !== undefined ? input.lastName : (current.lastName ?? "");
      const newFullName = `${effectiveFirstName} ${effectiveLastName}`.trim();
      if (input.firstName !== undefined || input.lastName !== undefined) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { fullName: newFullName, version: { increment: 1 } },
        });
      }
      if (newEmail) {
        await this.crm.updateCustomerEmail(user.customerId, newEmail);
      }
    }

    return this.getProfile(userId);
  }
}
