/**
 * Sales structural decomposition — SalesCompletionService (Wave 5 / Step 2.17C).
 *
 * Extracts the sole Sale completion method (completeSale) from SalesService.
 *
 * Invariants preserved:
 *   - Single-tx atomic: CAS OPEN→CLOSED, snapshot freeze, catalog reservation,
 *     outbox emit, history + audit — all in one PostgreSQL transaction.
 *   - After commit: publishEvent (delivery failure → FAILED + retryable, NOT rollback).
 *   - completeSale is the ONLY method that crosses Sales domain boundaries:
 *     CatalogService.reserveAvailability (owner boundary, DD-022) and
 *     EventBusService.emit (outbox, G2 retryable).
 *   - createOpportunityFromBuyerRequestSelection stays in facade (in-tx with Reverse).
 *   - No authority duplication: Sales remains sole-writer for sale.* tables.
 *
 * Behavior-preserving: zero API, contract, or authorization changes.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { isoUtc } from "../../shared/temporal";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type OrderRequestedPayload } from "../../eventbus/domain-events";
import { CatalogService } from "../catalog/catalog.service";
import { getEffectiveTravelerRequirements } from "../catalog/traveler-requirements";
import { Prisma } from "../../generated/prisma/client";
import {
  CheckoutStatus,
  SaleStatus,
} from "../../generated/prisma/enums";
import { writeHistory } from "./sales.history";
import type {
  SaleCommercialSnapshot,
  SaleDetailCompletionDto,
} from "./sales.contracts";

interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class SalesCompletionService {
  private readonly logger = new Logger(SalesCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Step 2.4 — canonical Sale completion → OrderRequested.
   *
   * Единственная команда завершения продажи (НЕ generic PATCH). Атомарный
   * workflow в ОДНОЙ PostgreSQL-транзакции (G4 + §27):
   *   1. CAS Sale OPEN → CLOSED (expectedVersion);
   *   2. проверки Checkout (ACTIVE, paymentTerms выбран, serviceDate, items);
   *   3. immutable commercial snapshot фиксируется на Sale (G3);
   *   4. availability резервируется через OWNER service (CatalogService.
   *      reserveAvailability — atomic last-slot, DD-022 closure);
   *   5. OrderRequested пишется в outbox (retryable) в той же транзакции.
   * После коммита — publishPending (delivery failure НЕ откатывает commit).
   */
  async completeSale(
    code: string,
    expectedVersion: number,
    assertCheckoutMutable: (row: { status: CheckoutStatus; code: string }) => void,
    actor: Actor,
  ): Promise<SaleDetailCompletionDto> {
    const sale = await this.prisma.sale.findUnique({ where: { code } });
    if (!sale) throw new NotFoundError(`Sale ${code} not found`);
    if (sale.status !== SaleStatus.OPEN) {
      throw new ConflictError(`Sale ${code} is already ${sale.status}`);
    }

    if (!sale.checkoutIntentId) {
      throw new ValidationDomainError(`Sale ${code} is not linked to a CheckoutIntent; completion requires checkout context`);
    }
    const checkout = await this.prisma.checkoutIntent.findUnique({
      where: { id: sale.checkoutIntentId },
    });
    if (!checkout) throw new NotFoundError(`CheckoutIntent for Sale ${code} not found`);
    assertCheckoutMutable(checkout);

    if (!checkout.paymentScheme || checkout.initialAmount === null || checkout.remainingAmount === null) {
      throw new ValidationDomainError(`CheckoutIntent ${checkout.code} requires payment terms before Sale completion`);
    }
    if (!checkout.serviceDate) {
      throw new ValidationDomainError(`CheckoutIntent ${checkout.code} requires a service date before Sale completion`);
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: checkout.quoteId },
      include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!quote) throw new NotFoundError(`Quote for CheckoutIntent ${checkout.code} not found`);
    if (quote.items.length === 0) {
      throw new ValidationDomainError(`Quote ${quote.code} has no items; cannot complete Sale`);
    }
    for (const it of quote.items) {
      if (it.productId.trim().length === 0 || it.tariffId.trim().length === 0 || it.quantity < 1) {
        throw new ValidationDomainError(`Quote ${quote.code} has an invalid item`);
      }
    }

    const customerId = checkout.customerId ?? sale.customerId ?? null;
    const now = new Date();
    const serviceDate = new Date(checkout.serviceDate);
    serviceDate.setUTCHours(0, 0, 0, 0);
    if (checkout.serviceTime && !checkout.serviceTimeZone) {
      throw new ValidationDomainError(`CheckoutIntent ${checkout.code} has serviceTime without a service timezone (canonical violation)`);
    }
    const serviceTime = checkout.serviceTime ?? null;
    const serviceEndTime = checkout.serviceEndTime ?? null;
    const serviceTimeZone = checkout.serviceTimeZone ?? null;

    const completed = await this.prisma.$transaction(async (tx) => {
      const res = await tx.sale.updateMany({
        where: { id: sale.id, version: expectedVersion, status: SaleStatus.OPEN },
        data: {
          status: SaleStatus.CLOSED,
          version: { increment: 1 },
          completedAt: now,
          completedById: actor.id,
          currency: checkout.currency,
          subtotal: checkout.subtotal,
          discountType: checkout.discountType,
          discountValue: checkout.discountValue,
          discountAmount: checkout.discountAmount,
          total: checkout.total,
          paymentScheme: checkout.paymentScheme,
          prepaymentType: checkout.prepaymentType,
          prepaymentValue: checkout.prepaymentValue,
          initialAmount: checkout.initialAmount,
          remainingAmount: checkout.remainingAmount,
          acquisitionSource: checkout.acquisitionSource,
          commissionSnapshot: checkout.commissionSnapshot ?? Prisma.JsonNull,
          serviceDate,
          serviceTime,
          serviceEndTime,
          serviceTimeZone,
        },
      });
      if (res.count === 0) throw new ConflictError(`Sale ${code} was modified concurrently; retry`);

      const snapshot: SaleCommercialSnapshot = {
        currency: checkout.currency,
        subtotal: String(checkout.subtotal),
        discountType: checkout.discountType,
        discountValue: checkout.discountValue ? String(checkout.discountValue) : null,
        discountAmount: checkout.discountAmount ? String(checkout.discountAmount) : null,
        total: String(checkout.total),
        paymentScheme: checkout.paymentScheme,
        prepaymentType: checkout.prepaymentType,
        prepaymentValue: checkout.prepaymentValue ? String(checkout.prepaymentValue) : null,
        initialAmount: checkout.initialAmount ? String(checkout.initialAmount) : null,
        remainingAmount: checkout.remainingAmount ? String(checkout.remainingAmount) : null,
        acquisitionSource: checkout.acquisitionSource,
        serviceTime,
        serviceEndTime,
        serviceTimeZone,
        commissionSnapshot: checkout.commissionSnapshot ?? null,
      };

      const reservations: { reservationId: string; code: string }[] = [];
      for (const it of quote.items) {
        const r = await this.catalog.reserveAvailability(tx, {
          productId: it.productId,
          tariffId: it.tariffId,
          date: serviceDate,
          quantity: it.quantity,
          sourceSaleId: sale.id,
          createdById: actor.id,
        });
        reservations.push(r);
      }
      const firstReservation = reservations[0]?.reservationId ?? null;
      await tx.sale.update({
        where: { id: sale.id },
        data: { reservationId: firstReservation },
      });

      const productsById = new Map(
        (
          await tx.product.findMany({
            where: { id: { in: quote.items.map((it) => it.productId) } },
            select: { id: true, type: true, travelerRequirements: true },
          })
        ).map((p) => [p.id, p]),
      );
      // D3 SR R2: PIN эффективных traveler requirements В МОМЕНТ acceptance
      // (та же транзакция, что Sale → CLOSED + completedAt). Frozen snapshot
      // кладётся в OrderRequested payload — consumer НЕ читает mutable Product
      // на T3 (race acceptance→pin невозможен, replay детерминирован).
      const firstItem = quote.items[0];
      const firstProduct = productsById.get(firstItem.productId);
      const pinnedRequirements = getEffectiveTravelerRequirements(
        firstProduct?.type ?? "TOUR",
        firstProduct?.travelerRequirements ?? null,
      );
      const travelerCount = await tx.checkoutIntentTraveler.count({
        where: { checkoutIntentId: checkout.id },
      });
      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Sale",
        aggregateId: sale.id,
        eventType: DomainEvents.OrderRequested,
        retryable: true,
        payload: {
          version: 1,
          saleId: sale.id,
          saleCode: sale.code,
          checkoutId: checkout.id,
          checkoutCode: checkout.code,
          quoteId: quote.id,
          customerId,
          reservationId: firstReservation,
          reservationIds: reservations.map((r) => r.reservationId),
          items: quote.items.map((it) => ({
            productId: it.productId,
            productCode: it.productCode,
            productTitle: it.productTitle,
            productType: productsById.get(it.productId)?.type ?? "",
            tariffId: it.tariffId,
            tariffCode: it.tariffCode,
            quantity: it.quantity,
            unitPrice: String(it.unitPrice),
            amount: String(it.amount),
          })),
          ...snapshot,
          serviceDate: serviceDate.toISOString().slice(0, 10),
          serviceTime,
          serviceEndTime,
          serviceTimeZone,
          sellerPartnerId: (checkout.commissionSnapshot as Record<string, unknown> | null)?.sellerPartnerId
            ? String((checkout.commissionSnapshot as Record<string, unknown>).sellerPartnerId)
            : null,
          // D3 SR R1/R2: реальный acceptance instant + frozen requirements snapshot.
          acceptedAt: now.toISOString(),
          pinnedRequirements,
        } as OrderRequestedPayload,
      });
      await tx.sale.update({
        where: { id: sale.id },
        data: { orderRequestedEventId: eventId },
      });

      await writeHistory(tx, "saleHistory", sale.id, "completed", SaleStatus.OPEN, SaleStatus.CLOSED, actor, {
        completion: "sale_completed_order_requested",
        reservationIds: reservations.map((r) => r.code),
        eventId,
        total: snapshot.total,
        currency: snapshot.currency,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.sale.completed",
        resource: "Sale",
        resourceId: sale.id,
        details: {
          code: sale.code,
          from: SaleStatus.OPEN,
          to: SaleStatus.CLOSED,
          reservationCodes: reservations.map((r) => r.code),
          eventId,
          total: snapshot.total,
          currency: snapshot.currency,
        },
      });
      return { saleId: sale.id, eventId, reservationCodes: reservations.map((r) => r.code) };
    });

    // Delivery — AFTER commit (failure → FAILED + retryable, NOT rollback).
    await this.eventBus.publishEvent(completed.eventId);

    return {
      saleId: completed.saleId,
      saleCode: code,
      status: SaleStatus.CLOSED,
      version: expectedVersion + 1,
      completedAt: isoUtc(now),
      orderRequestedEventId: completed.eventId,
      reservations: completed.reservationCodes,
    };
  }
}
