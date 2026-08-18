/**
 * Sales structural decomposition — SalesCheckoutService (Wave 4 / Step 2.17C).
 *
 * Extracts CheckoutIntent lifecycle writes from SalesService:
 *   - createCheckoutIntent
 *   - setCheckoutTravelers, setCheckoutServiceDate, setCheckoutPaymentTerms
 *   - cancelCheckoutIntent, revalidateCheckoutIntent
 *
 * Invariants preserved:
 *   - Each method owns its own $transaction boundary (CAS version, history, audit).
 *   - createCheckoutIntent: frozen snapshot from ISSUED Quote, availability check.
 *   - setCheckoutServiceDate: local time semantics with frozen timezone authority.
 *   - cancelCheckoutIntent: terminal transition ACTIVE → CANCELLED.
 *   - revalidateCheckoutIntent: read-like CAS (no version increment).
 *   - assertCheckoutNotCompleted: Sale CLOSED → immutable.
 *   - No authority duplication: Sales remains sole-writer for checkoutIntent.* tables.
 *
 * Behavior-preserving: zero API, contract, or authorization changes.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { IdsService } from "../../shared/ids.service";
import { Prisma } from "../../generated/prisma/client";
import {
  CheckoutStatus,
  PaymentScheme,
  QuoteStatus,
  SalesAcquisitionSource,
  SaleStatus,
} from "../../generated/prisma/enums";
import { isDateOnly, parseServiceDate, CHECKOUT_AVAILABILITY_SEMANTICS } from "./sales.checkout";
import { isLocalTime } from "../../shared/service-time";
import { computePaymentTerms } from "./sales.payment-terms";
import { validateFrozenSnapshot } from "./sales.money";
import { writeHistory, pagination, PAGE_SIZE_DEFAULT } from "./sales.history";
import { toCheckoutIntentDetailDto, checkoutQuoteMeta } from "./sales.projection";
import { assertOptionalCustomer } from "./sales-helpers";
import { isoUtc } from "../../shared/temporal";
import type {
  CheckoutIntentAvailabilityDto,
  CheckoutIntentDetailDto,
} from "./sales.contracts";

interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class SalesCheckoutService {
  private readonly logger = new Logger(SalesCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly ids: IdsService,
  ) {}

  /* ── CheckoutIntent writes ─────────────────────────────────────────────── */

  async createCheckoutIntent(
    input: {
      quoteId: string;
      customerId?: string | null;
      serviceDate?: string | null;
      travelers?: Array<{ firstName: string; lastName: string; birthDate?: string | null }> | null;
    },
    getCheckoutIntentDetail: (code: string) => Promise<CheckoutIntentDetailDto>,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        travelers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!quote) throw new NotFoundError(`Quote ${input.quoteId} not found`);
    if (quote.status !== QuoteStatus.ISSUED) {
      throw new ValidationDomainError(`Quote ${quote.code} is ${quote.status}; checkout requires an issued quote`);
    }
    if (!quote.validUntil || quote.validUntil <= new Date()) {
      throw new ValidationDomainError(`Quote ${quote.code} has expired; cannot create checkout intent`);
    }
    if (quote.subtotal === null || quote.total === null) {
      throw new ValidationDomainError(`Quote ${quote.code} has no frozen totals`);
    }

    validateFrozenSnapshot({
      currency: quote.currency,
      lines: quote.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, amount: i.amount })),
      subtotal: quote.subtotal,
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      discountAmount: quote.discountAmount,
      total: quote.total,
    });

    const customerId = input.customerId === undefined || input.customerId === null ? quote.customerId : input.customerId;
    await assertOptionalCustomer(this.prisma, customerId);

    const serviceDate = input.serviceDate ? parseServiceDate(input.serviceDate) : null;

    const zoneRows = await this.prisma.product.findMany({
      where: { id: { in: quote.items.map((i) => i.productId) } },
      select: { serviceTimeZone: true },
    });
    const zones = new Set<string>();
    for (const z of zoneRows) if (z.serviceTimeZone) zones.add(z.serviceTimeZone);
    const serviceTimeZone = zones.size === 1 ? [...zones][0] : null;

    const travelers =
      input.travelers ??
      quote.travelers.map((t) => ({
        firstName: t.firstName,
        lastName: t.lastName,
        birthDate: t.birthDate ? t.birthDate.toISOString().slice(0, 10) : null,
      }));
    this.assertTravelersValid(travelers);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CKT");
      const row = await tx.checkoutIntent.create({
        data: {
          code,
          quoteId: quote.id,
          customerId: customerId ?? null,
          status: CheckoutStatus.ACTIVE,
          currency: quote.currency,
          subtotal: quote.subtotal as Prisma.Decimal,
          discountType: quote.discountType,
          discountValue: quote.discountValue,
          discountAmount: quote.discountAmount,
          total: quote.total as Prisma.Decimal,
          commissionSnapshot: quote.commissionSnapshot ?? Prisma.JsonNull,
          serviceDate,
          serviceTimeZone,
          acquisitionSource: quote.acquisitionSource ?? SalesAcquisitionSource.DIRECT,
          createdById: actor.id,
        },
      });
      if (travelers.length > 0) {
        await tx.checkoutIntentTraveler.createMany({
          data: travelers.map((t) => ({
            checkoutIntentId: row.id,
            firstName: t.firstName.trim(),
            lastName: t.lastName.trim(),
            birthDate: t.birthDate ? new Date(`${t.birthDate}T00:00:00.000Z`) : null,
          })),
        });
      }
      await writeHistory(tx, "checkoutIntentHistory", row.id, "created", null, row.status, actor, {
        quoteCode: quote.code,
        currency: quote.currency,
        total: String(quote.total),
        serviceDate: serviceDate ? serviceDate.toISOString().slice(0, 10) : null,
        serviceTimeZone,
        acquisitionSource: row.acquisitionSource,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.checkout.created",
        resource: "CheckoutIntent",
        resourceId: row.id,
        details: { code: row.code, quoteCode: quote.code, total: String(quote.total) },
      });
      return row;
    });
    this.logger.log(`CheckoutIntent ${created.code} created for Quote ${quote.code} by ${actor.username}`);
    return getCheckoutIntentDetail(created.code);
  }

  async setCheckoutTravelers(
    code: string,
    travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>,
    expectedVersion: number,
    getCheckoutIntentDetail: (code: string) => Promise<CheckoutIntentDetailDto>,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    const row = await this.prisma.checkoutIntent.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    this.assertCheckoutMutable(row);
    await this.assertCheckoutNotCompleted(row);
    this.assertTravelersValid(travelers);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.checkoutIntent.updateMany({
        where: { id: row.id, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`CheckoutIntent ${code} was modified concurrently; retry`);
      await tx.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: row.id } });
      if (travelers.length > 0) {
        await tx.checkoutIntentTraveler.createMany({
          data: travelers.map((t) => ({
            checkoutIntentId: row.id,
            firstName: t.firstName.trim(),
            lastName: t.lastName.trim(),
            birthDate: t.birthDate ? new Date(`${t.birthDate}T00:00:00.000Z`) : null,
          })),
        });
      }
      await writeHistory(tx, "checkoutIntentHistory", row.id, "travelers_changed", null, null, actor, {
        count: travelers.length,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.checkout.travelers_changed",
        resource: "CheckoutIntent",
        resourceId: row.id,
        details: { code: row.code, count: travelers.length },
      });
    });
    return getCheckoutIntentDetail(code);
  }

  async setCheckoutServiceDate(
    code: string,
    input: { serviceDate: string; serviceTime?: string | null; serviceEndTime?: string | null },
    expectedVersion: number,
    getCheckoutIntentDetail: (code: string) => Promise<CheckoutIntentDetailDto>,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    const row = await this.prisma.checkoutIntent.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    this.assertCheckoutMutable(row);
    await this.assertCheckoutNotCompleted(row);
    const parsed = parseServiceDate(input.serviceDate);

    const nextTime = input.serviceTime === undefined ? (row.serviceTime ?? null) : input.serviceTime;
    const nextEndTime = input.serviceEndTime === undefined ? (row.serviceEndTime ?? null) : input.serviceEndTime;
    if (nextTime !== null && nextTime !== undefined) {
      if (!isLocalTime(nextTime)) throw new ValidationDomainError("serviceTime must be local wall-clock HH:mm");
      if (!row.serviceTimeZone) {
        throw new ValidationDomainError(
          `CheckoutIntent ${row.code} has no service timezone (products declare no IANA timezone); exact-time selection is not available`,
        );
      }
      if (nextEndTime !== null && nextEndTime !== undefined && !isLocalTime(nextEndTime)) {
        throw new ValidationDomainError("serviceEndTime must be local wall-clock HH:mm");
      }
    } else if (nextEndTime !== null && nextEndTime !== undefined) {
      throw new ValidationDomainError("serviceEndTime requires serviceTime");
    }

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.checkoutIntent.updateMany({
        where: { id: row.id, version: expectedVersion },
        data: { serviceDate: parsed, serviceTime: nextTime ?? null, serviceEndTime: nextEndTime ?? null, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`CheckoutIntent ${code} was modified concurrently; retry`);
      await writeHistory(tx, "checkoutIntentHistory", row.id, "service_date_changed", null, null, actor, {
        serviceDate: parsed.toISOString().slice(0, 10),
        serviceTime: nextTime ?? null,
        serviceEndTime: nextEndTime ?? null,
        serviceTimeZone: row.serviceTimeZone ?? null,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.checkout.service_date_changed",
        resource: "CheckoutIntent",
        resourceId: row.id,
        details: {
          code: row.code,
          serviceDate: parsed.toISOString().slice(0, 10),
          serviceTime: nextTime ?? null,
          serviceEndTime: nextEndTime ?? null,
        },
      });
    });
    return getCheckoutIntentDetail(code);
  }

  async revalidateCheckoutIntent(
    code: string,
    expectedVersion: number,
    checkoutQuoteItems: (quoteId: string) => Promise<Array<{ id: string; productId: string; productCode: string; productTitle: string; tariffId: string; tariffCode: string; quantity: number }>>,
    availabilityFor: (items: Array<{ id: string; productId: string; productCode: string; productTitle: string; tariffId: string; tariffCode: string; quantity: number }>, serviceDate: Date | null) => Promise<CheckoutIntentAvailabilityDto>,
    getCheckoutIntentDetail: (code: string) => Promise<CheckoutIntentDetailDto>,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    const row = await this.prisma.checkoutIntent.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    this.assertCheckoutMutable(row);
    const availability = await availabilityFor(await checkoutQuoteItems(row.quoteId), row.serviceDate);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.checkoutIntent.updateMany({ where: { id: row.id, version: expectedVersion }, data: {} });
      if (res.count === 0) throw new ConflictError(`CheckoutIntent ${code} was modified concurrently; retry`);
      await writeHistory(tx, "checkoutIntentHistory", row.id, "availability_checked", null, null, actor, {
        state: availability.state,
        level: aggregateAvailabilityLevel(availability.items),
        itemCount: availability.items.length,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.checkout.revalidated",
        resource: "CheckoutIntent",
        resourceId: row.id,
        details: { code: row.code, state: availability.state, level: aggregateAvailabilityLevel(availability.items) },
      });
    });
    return getCheckoutIntentDetail(code);
  }

  async cancelCheckoutIntent(
    code: string,
    expectedVersion: number,
    getCheckoutIntentDetail: (code: string) => Promise<CheckoutIntentDetailDto>,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    const row = await this.prisma.checkoutIntent.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    if (row.status !== CheckoutStatus.ACTIVE) {
      throw new ValidationDomainError(`CheckoutIntent ${code} is already ${row.status}`);
    }
    await this.assertCheckoutNotCompleted(row);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.checkoutIntent.updateMany({
        where: { id: row.id, version: expectedVersion },
        data: { status: CheckoutStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`CheckoutIntent ${code} was modified concurrently; retry`);
      await writeHistory(tx, "checkoutIntentHistory", row.id, "cancelled", row.status, CheckoutStatus.CANCELLED, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.checkout.cancelled",
        resource: "CheckoutIntent",
        resourceId: row.id,
        details: { code: row.code, from: row.status, to: CheckoutStatus.CANCELLED },
      });
    });
    return getCheckoutIntentDetail(code);
  }

  async setCheckoutPaymentTerms(
    code: string,
    input: {
      scheme: PaymentScheme;
      prepaymentType?: "PERCENTAGE" | "FIXED" | null;
      prepaymentValue?: string | null;
    },
    expectedVersion: number,
    getCheckoutIntentDetail: (code: string) => Promise<CheckoutIntentDetailDto>,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    const row = await this.prisma.checkoutIntent.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    this.assertCheckoutMutable(row);
    await this.assertCheckoutNotCompleted(row);
    const computed = computePaymentTerms(row.total, {
      scheme: input.scheme,
      prepaymentType: input.prepaymentType ?? null,
      prepaymentValue: input.prepaymentValue ?? null,
    });

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.checkoutIntent.updateMany({
        where: { id: row.id, version: expectedVersion },
        data: {
          paymentScheme: computed.scheme,
          prepaymentType: computed.prepaymentType,
          prepaymentValue: computed.prepaymentValue,
          initialAmount: computed.initialAmount,
          remainingAmount: computed.remainingAmount,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new ConflictError(`CheckoutIntent ${code} was modified concurrently; retry`);
      await writeHistory(tx, "checkoutIntentHistory", row.id, "payment_terms_changed", row.paymentScheme, computed.scheme, actor, {
        scheme: computed.scheme,
        prepaymentType: computed.prepaymentType ?? null,
        initialAmount: String(computed.initialAmount),
        remainingAmount: String(computed.remainingAmount),
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.checkout.payment_terms_changed",
        resource: "CheckoutIntent",
        resourceId: row.id,
        details: { code: row.code, from: row.paymentScheme ?? null, to: computed.scheme },
      });
    });
    return getCheckoutIntentDetail(code);
  }

  /* ── Private helpers ───────────────────────────────────────────────────── */

  private assertCheckoutMutable(row: { status: CheckoutStatus; code: string }): void {
    if (row.status !== CheckoutStatus.ACTIVE) {
      throw new ValidationDomainError(`CheckoutIntent ${row.code} is ${row.status}`);
    }
  }

  private async assertCheckoutNotCompleted(row: { id: string; code: string }): Promise<void> {
    const completed = await this.prisma.sale.findFirst({
      where: { checkoutIntentId: row.id, status: SaleStatus.CLOSED },
      select: { id: true },
    });
    if (completed) {
      throw new ConflictError(`CheckoutIntent ${row.code} is already completed by Sale; immutable after completion`);
    }
  }

  private assertTravelersValid(travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>): void {
    if (travelers.length > 50) throw new ValidationDomainError("Too many travelers (max 50)");
    for (const t of travelers) {
      if (t.firstName.trim().length === 0 || t.firstName.length > 100) throw new ValidationDomainError("firstName must be 1..100 chars");
      if (t.lastName.trim().length === 0 || t.lastName.length > 100) throw new ValidationDomainError("lastName must be 1..100 chars");
      if (t.birthDate && !isDateOnly(t.birthDate)) throw new ValidationDomainError("birthDate must be a calendar date (YYYY-MM-DD)");
      if (t.birthDate && new Date(`${t.birthDate}T00:00:00.000Z`).getTime() > Date.now()) {
        throw new ValidationDomainError("birthDate must not be in the future");
      }
    }
  }
}

/**
 * Агрегированный level для history/audit (без PII): UNAVAILABLE, если хоть один
 * item недоступен; иначе AVAILABLE если все; иначе NOT_CONFIGURED.
 */
function aggregateAvailabilityLevel(items: Array<{ level: "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED" }>): string {
  if (items.some((i) => i.level === "UNAVAILABLE")) return "UNAVAILABLE";
  if (items.length > 0 && items.every((i) => i.level === "AVAILABLE")) return "AVAILABLE";
  return "NOT_CONFIGURED";
}
