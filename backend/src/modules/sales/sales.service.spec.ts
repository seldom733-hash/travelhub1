/**
 * STEP 2.17C — Wave 0 characterization tests for SalesService.
 *
 * Purpose: pin existing behavior BEFORE extraction in Waves 1-6.
 * These tests exercise the public API with mocked Prisma/Security/EventBus/Catalog
 * to verify DTO projections, issueQuote money-freeze, and completeSale atomicity.
 *
 * After Wave 1 (sales.projection.ts extraction) and later waves (facade delegation),
 * these same tests pass unchanged — proving behavior preservation.
 */
import { Prisma } from "../../generated/prisma/client";
import {
  CheckoutStatus,
  CommissionChannel,
  LeadStatus,
  OpportunityStatus,
  PaymentScheme,
  QuoteDiscountType,
  QuoteStatus,
  SalesAcquisitionSource,
  SaleStatus,
  RoleCode,
  PaymentPrepaymentType,
} from "../../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { SalesService } from "./sales.service";
import { SalesQueryService } from "./sales-query.service";
import { SalesLifecycleService } from "./sales-lifecycle.service";
import { SalesQuoteService } from "./sales-quote.service";
import { SalesCheckoutService } from "./sales-checkout.service";
import { SalesCompletionService } from "./sales-completion.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";
import type { EventBusService } from "../../eventbus/eventbus.service";
import type { CatalogService } from "../catalog/catalog.service";
import type { CommissionPolicyService } from "../finance/commission-policy.service";

/* ───────────────────────────────────────────────────────────────────────────
 * Mock infrastructure
 * ─────────────────────────────────────────────────────────────────────────── */

const ACTOR = { id: "actor-1", username: "staff1" };

function makeDate(s: string): Date {
  return new Date(s);
}

function utc(d: Date): string {
  return d.toISOString();
}

/** Minimal Prisma stub — only the models/methods that SalesService touches. */
function makePrismaStub() {
  const prisma = {
    lead: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "lead-1", createdAt: new Date(), updatedAt: new Date(), version: 1, ...data })),
      findUniqueOrThrow: jest.fn(),
    },
    opportunity: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "opp-1", createdAt: new Date(), updatedAt: new Date(), version: 1, ...data })),
      findUniqueOrThrow: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "qte-1", createdAt: new Date(), updatedAt: new Date(), version: 1, ...data })),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    quoteItem: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    quoteTraveler: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    sale: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "sal-1", createdAt: new Date(), updatedAt: new Date(), version: 1, ...data })),
      update: jest.fn(),
    },
    checkoutIntent: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "ckt-1", createdAt: new Date(), updatedAt: new Date(), version: 1, ...data })),
      update: jest.fn(),
    },
    checkoutIntentTraveler: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    tariff: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    availability: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    commercialPeriod: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    commercialRestriction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    leadHistory: { create: jest.fn().mockResolvedValue({ id: "lh-1" }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    opportunityHistory: { create: jest.fn().mockResolvedValue({ id: "oh-1" }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    quoteHistory: { create: jest.fn().mockResolvedValue({ id: "qh-1" }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    saleHistory: { create: jest.fn().mockResolvedValue({ id: "sh-1" }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    checkoutIntentHistory: { create: jest.fn().mockResolvedValue({ id: "ch-1" }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(),
  };
  // $transaction passes the same stub as tx
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function makeService(overrides: Partial<{
  prisma: ReturnType<typeof makePrismaStub>;
  customerExists: boolean;
  userExists: boolean;
  userRole: string;
}> = {}) {
  const prisma = overrides.prisma ?? makePrismaStub();

  // Cross-domain existence stubs
  if (overrides.customerExists) {
    prisma.customer.findUnique.mockResolvedValue({ id: "cus-1" });
  }
  if (overrides.userExists) {
    prisma.user.findUnique.mockResolvedValue({ id: overrides.userRole ?? "staff-1", role: { code: overrides.userRole ?? RoleCode.SALES_MANAGER } });
  }

  const ids = { nextCode: jest.fn().mockResolvedValue("LED-00000001") } as unknown as IdsService;
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  const eventBus = {
    emit: jest.fn().mockResolvedValue("evt-1"),
    publishEvent: jest.fn().mockResolvedValue(1),
  } as unknown as EventBusService & { emit: jest.Mock; publishEvent: jest.Mock };
  const catalog = {
    reserveAvailability: jest.fn().mockResolvedValue({ reservationId: "res-1", code: "RES-00000001" }),
  } as unknown as CatalogService & { reserveAvailability: jest.Mock };
  const commissionPolicies = {
    resolve: jest.fn().mockResolvedValue({ found: false, reason: "NO_POLICY" }),
  } as unknown as CommissionPolicyService & { resolve: jest.Mock };

  // Wave 2: real SalesQueryService with the same mock prisma
  const queryService = new SalesQueryService(prisma as unknown as PrismaService);
  const lifecycleService = new SalesLifecycleService(prisma as unknown as PrismaService, security, ids);
  const quoteService = new SalesQuoteService(prisma as unknown as PrismaService, ids, security, commissionPolicies);
  const checkoutService = new SalesCheckoutService(prisma as unknown as PrismaService, security, ids);
  const completionService = new SalesCompletionService(prisma as unknown as PrismaService, security, eventBus, catalog);
  const service = new SalesService(prisma as unknown as PrismaService, ids, security, eventBus, catalog, queryService, lifecycleService, quoteService, checkoutService, completionService);
  return { service, prisma, ids, security, eventBus, catalog, commissionPolicies };
}

/* ───────────────────────────────────────────────────────────────────────────
 * A. DTO Projection golden tests
 *
 * Each test pins the exact transformation from a Prisma row to a DTO.
 * After Wave 1 extraction to sales.projection.ts, these same assertions
 * still pass because the service delegates to the module function.
 * ─────────────────────────────────────────────────────────────────────────── */

describe("SalesService — Wave 0 characterization", () => {
  describe("A. DTO Projection golden tests", () => {
    describe("Lead projections", () => {
      it("listLeads returns correctly shaped DTOs with isoUtc dates", async () => {
        const now = new Date("2026-08-18T10:00:00Z");
        const leadRow = {
          id: "lead-1",
          code: "LED-00000001",
          name: "Acme Corp",
          customerId: "cus-1",
          assignedToId: "usr-1",
          status: LeadStatus.NEW,
          version: 1,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
        };
        const { service, prisma } = makeService();
        prisma.lead.findMany.mockResolvedValue([leadRow]);
        prisma.lead.count.mockResolvedValue(1);

        const result = await service.listLeads({});

        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.items[0]).toEqual({
          id: "lead-1",
          code: "LED-00000001",
          name: "Acme Corp",
          customerId: "cus-1",
          assignedToId: "usr-1",
          status: LeadStatus.NEW,
          version: 1,
          createdById: "actor-1",
          createdAt: utc(now),
          updatedAt: utc(now),
        });
      });

      it("getLeadByCode throws NotFoundError for unknown code", async () => {
        const { service, prisma } = makeService();
        prisma.lead.findUnique.mockResolvedValue(null);

        await expect(service.getLeadByCode("LED-99999999")).rejects.toThrow(NotFoundError);
      });

      it("leadHistory returns history items with isoUtc dates", async () => {
        const { service, prisma } = makeService();
        prisma.lead.findUnique.mockResolvedValue({ id: "lead-1" });
        prisma.leadHistory.findMany.mockResolvedValue([{
          id: "hist-1",
          action: "created",
          from: null,
          to: "NEW",
          actorId: "actor-1",
          actorName: "staff1",
          createdAt: new Date("2026-08-18T10:00:00Z"),
        }]);
        prisma.leadHistory.count.mockResolvedValue(1);

        const result = await service.leadHistory("LED-00000001");

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toEqual({
          id: "hist-1",
          action: "created",
          from: null,
          to: "NEW",
          actorId: "actor-1",
          actorName: "staff1",
          createdAt: utc(new Date("2026-08-18T10:00:00Z")),
        });
      });
    });

    describe("Opportunity projections", () => {
      it("getOpportunityByCode returns DTO with acquisition source fields", async () => {
        const now = new Date("2026-08-18T11:00:00Z");
        const oppRow = {
          id: "opp-1",
          code: "OPP-00000001",
          title: "Big Deal",
          leadId: "lead-1",
          customerId: "cus-1",
          assignedToId: "usr-1",
          status: OpportunityStatus.OPEN,
          version: 2,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
          buyerRequestId: "br-1",
          proposalId: "prop-1",
          sellerId: "par-1",
          acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST,
        };
        const { service, prisma } = makeService();
        prisma.opportunity.findUnique.mockResolvedValue(oppRow);

        const result = await service.getOpportunityByCode("OPP-00000001");

        expect(result).toEqual({
          id: "opp-1",
          code: "OPP-00000001",
          title: "Big Deal",
          leadId: "lead-1",
          customerId: "cus-1",
          assignedToId: "usr-1",
          status: OpportunityStatus.OPEN,
          version: 2,
          createdById: "actor-1",
          createdAt: utc(now),
          updatedAt: utc(now),
          buyerRequestId: "br-1",
          proposalId: "prop-1",
          sellerId: "par-1",
          acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST,
        });
      });
    });

    describe("Quote projections", () => {
      it("getQuoteDetail returns items/travelers with computed totals for DRAFT", async () => {
        const now = new Date("2026-08-18T12:00:00Z");
        const quoteRow = {
          id: "qte-1",
          code: "QTE-00000001",
          customerId: "cus-1",
          opportunityId: null,
          productId: null,
          status: QuoteStatus.DRAFT,
          version: 1,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
          currency: "USD",
          validUntil: null,
          issuedAt: null,
          discountType: QuoteDiscountType.NONE,
          discountValue: null,
          discountAmount: null,
          subtotal: null,
          total: null,
          acquisitionSource: null,
          items: [
            {
              id: "item-1",
              productId: "prod-1",
              productCode: "PRD-00000001",
              productTitle: "Hotel",
              tariffId: "tar-1",
              tariffCode: "TAR-00000001",
              tariffName: "Standard",
              quantity: 2,
              serviceDate: null,
              unitPrice: new Prisma.Decimal("100.00"),
              currency: "USD",
              amount: new Prisma.Decimal("200.00"),
              restrictionSnapshot: null,
            },
          ],
          travelers: [
            { id: "trav-1", firstName: "John", lastName: "Doe", birthDate: new Date("1990-01-01T00:00:00Z") },
          ],
        };
        const { service, prisma } = makeService();
        prisma.quote.findUnique.mockResolvedValue(quoteRow);

        const result = await service.getQuoteDetail("QTE-00000001");

        expect(result.code).toBe("QTE-00000001");
        expect(result.status).toBe(QuoteStatus.DRAFT);
        expect(result.currency).toBe("USD");
        // DRAFT totals computed on-the-fly from items (Decimal String strips trailing zeros)
        expect(result.subtotal).toBe(String(new Prisma.Decimal("200.00")));
        expect(result.total).toBe(String(new Prisma.Decimal("200.00")));
        expect(result.discountAmount).toBe(String(new Prisma.Decimal(0).toDecimalPlaces(2)));
        // Items
        expect(result.items).toHaveLength(1);
        expect(result.items[0].productId).toBe("prod-1");
        // Decimal String() normalizes: "100.00" → "100", "200.00" → "200"
        expect(result.items[0].unitPrice).toBe(String(new Prisma.Decimal("100.00")));
        expect(result.items[0].amount).toBe(String(new Prisma.Decimal("200.00")));
        expect(result.items[0].quantity).toBe(2);
        expect(result.items[0].serviceDate).toBeNull();
        // Travelers
        expect(result.travelers).toHaveLength(1);
        expect(result.travelers[0].firstName).toBe("John");
        expect(result.travelers[0].lastName).toBe("Doe");
      });

      it("getQuoteByCode returns DTO (summary, no items)", async () => {
        const now = new Date("2026-08-18T12:30:00Z");
        const quoteRow = {
          id: "qte-2",
          code: "QTE-00000002",
          customerId: null,
          opportunityId: null,
          productId: null,
          status: QuoteStatus.ISSUED,
          version: 2,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
          currency: "EUR",
          validUntil: new Date("2026-09-01T00:00:00Z"),
          issuedAt: new Date("2026-08-18T12:30:00Z"),
          discountType: QuoteDiscountType.NONE,
          discountValue: null,
          discountAmount: null,
          subtotal: new Prisma.Decimal("500.00"),
          total: new Prisma.Decimal("500.00"),
          acquisitionSource: SalesAcquisitionSource.MARKETPLACE,
        };
        const { service, prisma } = makeService();
        prisma.quote.findUnique.mockResolvedValue(quoteRow);

        const result = await service.getQuoteByCode("QTE-00000002");

        expect(result.code).toBe("QTE-00000002");
        expect(result.status).toBe(QuoteStatus.ISSUED);
        expect(result.currency).toBe("EUR");
        expect(result.total).toBe(String(new Prisma.Decimal("500.00")));
        expect(result.acquisitionSource).toBe(SalesAcquisitionSource.MARKETPLACE);
        expect(result.validUntil).toBe(utc(new Date("2026-09-01T00:00:00Z")));
        expect(result.issuedAt).toBe(utc(new Date("2026-08-18T12:30:00Z")));
      });
    });

    describe("Sale projections", () => {
      it("getSaleByCode returns commercial snapshot for OPEN sale (null snapshot)", async () => {
        const now = new Date("2026-08-18T13:00:00Z");
        const saleRow = {
          id: "sal-1",
          code: "SAL-00000001",
          customerId: "cus-1",
          opportunityId: "opp-1",
          quoteId: "qte-1",
          checkoutIntentId: "ckt-1",
          status: SaleStatus.OPEN,
          version: 1,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
          currency: null,
          subtotal: null,
          discountType: null,
          discountValue: null,
          discountAmount: null,
          total: null,
          paymentScheme: null,
          prepaymentType: null,
          prepaymentValue: null,
          initialAmount: null,
          remainingAmount: null,
          acquisitionSource: null,
          serviceTime: null,
          serviceEndTime: null,
          serviceTimeZone: null,
          commissionSnapshot: null,
          completedAt: null,
          completedById: null,
          reservationId: null,
          orderRequestedEventId: null,
        };
        const { service, prisma } = makeService();
        prisma.sale.findUnique.mockResolvedValue(saleRow);

        const result = await service.getSaleByCode("SAL-00000001");

        expect(result.code).toBe("SAL-00000001");
        expect(result.status).toBe(SaleStatus.OPEN);
        expect(result.commercialSnapshot).toBeNull();
        expect(result.completedAt).toBeNull();
      });

      it("getSaleByCode returns populated commercial snapshot for CLOSED sale", async () => {
        const now = new Date("2026-08-18T13:00:00Z");
        const completedAt = new Date("2026-08-18T14:00:00Z");
        const saleRow = {
          id: "sal-2",
          code: "SAL-00000002",
          customerId: "cus-1",
          opportunityId: "opp-1",
          quoteId: "qte-1",
          checkoutIntentId: "ckt-1",
          status: SaleStatus.CLOSED,
          version: 2,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
          currency: "USD",
          subtotal: new Prisma.Decimal("450.00"),
          discountType: QuoteDiscountType.PERCENTAGE,
          discountValue: new Prisma.Decimal("10.00"),
          discountAmount: new Prisma.Decimal("45.00"),
          total: new Prisma.Decimal("405.00"),
          paymentScheme: PaymentScheme.FULL_PREPAYMENT,
          prepaymentType: null,
          prepaymentValue: null,
          initialAmount: new Prisma.Decimal("405.00"),
          remainingAmount: new Prisma.Decimal("0"),
          acquisitionSource: SalesAcquisitionSource.MARKETPLACE,
          serviceTime: "10:00",
          serviceEndTime: "14:00",
          serviceTimeZone: "Europe/Moscow",
          commissionSnapshot: { policyCode: "CMP-001", rate: "0.15" },
          completedAt,
          completedById: "actor-1",
          reservationId: "res-1",
          orderRequestedEventId: "evt-1",
        };
        const { service, prisma } = makeService();
        prisma.sale.findUnique.mockResolvedValue(saleRow);

        const result = await service.getSaleByCode("SAL-00000002");

        expect(result.status).toBe(SaleStatus.CLOSED);
        expect(result.commercialSnapshot).not.toBeNull();
        expect(result.commercialSnapshot!.currency).toBe("USD");
        expect(result.commercialSnapshot!.total).toBe(String(new Prisma.Decimal("405.00")));
        expect(result.commercialSnapshot!.acquisitionSource).toBe(SalesAcquisitionSource.MARKETPLACE);
        expect(result.commercialSnapshot!.serviceTimeZone).toBe("Europe/Moscow");
        expect(result.commercialSnapshot!.commissionSnapshot).toEqual({ policyCode: "CMP-001", rate: "0.15" });
        expect(result.completedAt).toBe(utc(completedAt));
      });
    });

    describe("CheckoutIntent projections", () => {
      it("getCheckoutIntentByCode returns detail with paymentTerms + availability", async () => {
        const now = new Date("2026-08-18T15:00:00Z");
        const cktRow = {
          id: "ckt-1",
          code: "CKT-00000001",
          quoteId: "qte-1",
          customerId: "cus-1",
          status: CheckoutStatus.ACTIVE,
          version: 1,
          currency: "USD",
          subtotal: new Prisma.Decimal("450.00"),
          discountType: QuoteDiscountType.PERCENTAGE,
          discountValue: new Prisma.Decimal("10.00"),
          discountAmount: new Prisma.Decimal("45.00"),
          total: new Prisma.Decimal("405.00"),
          commissionSnapshot: null,
          paymentScheme: PaymentScheme.PARTIAL_PREPAYMENT,
          prepaymentType: "PERCENTAGE",
          prepaymentValue: new Prisma.Decimal("30.00"),
          initialAmount: new Prisma.Decimal("121.50"),
          remainingAmount: new Prisma.Decimal("283.50"),
          serviceDate: new Date("2026-09-01T00:00:00Z"),
          serviceTime: null,
          serviceEndTime: null,
          serviceTimeZone: "Europe/Moscow",
          acquisitionSource: SalesAcquisitionSource.DIRECT,
          cancelledAt: null,
          createdById: "actor-1",
          createdAt: now,
          updatedAt: now,
          travelers: [],
        };
        const { service, prisma } = makeService();
        prisma.checkoutIntent.findUnique.mockResolvedValue(cktRow);
        // For getCheckoutIntentDetail: quote lookup
        prisma.quote.findUnique.mockResolvedValue({ code: "QTE-00000001", validUntil: new Date("2026-09-15T00:00:00Z") });
        // quoteItems for availability
        prisma.quoteItem.findMany.mockResolvedValue([]);

        const result = await service.getCheckoutIntentByCode("CKT-00000001");

        expect(result.code).toBe("CKT-00000001");
        expect(result.status).toBe(CheckoutStatus.ACTIVE);
        expect(result.paymentTerms).not.toBeNull();
        expect(result.paymentTerms!.scheme).toBe(PaymentScheme.PARTIAL_PREPAYMENT);
        expect(result.paymentTerms!.initialAmount).toBe(String(new Prisma.Decimal("121.50")));
        expect(result.paymentTerms!.remainingAmount).toBe(String(new Prisma.Decimal("283.50")));
        // serviceDate is set → availability is CHECKED (no rows → NOT_CONFIGURED per item)
        expect(result.availability.state).toBe("CHECKED_NOT_RESERVED");
        expect(result.quoteExpired).toBe(false);
      });
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * B. issueQuote characterization
   *
   * Pins: CAS version check, items validation, money freeze (Decimal),
   * commission snapshot, history + audit, terminal state guard.
   * ───────────────────────────────────────────────────────────────────────── */

  describe("B. issueQuote characterization", () => {
    const NOW = new Date("2026-08-18T16:00:00Z");

    function makeDraftQuote(overrides: Record<string, unknown> = {}) {
      return {
        id: "qte-1",
        code: "QTE-00000001",
        status: QuoteStatus.DRAFT,
        version: 1,
        currency: "USD",
        validUntil: new Date("2026-09-01T00:00:00Z"),
        discountType: QuoteDiscountType.NONE,
        discountValue: null,
        subtotal: null,
        total: null,
        acquisitionSource: SalesAcquisitionSource.MARKETPLACE,
        createdAt: NOW,
        updatedAt: NOW,
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            productCode: "PRD-00000001",
            productTitle: "Hotel",
            tariffId: "tar-1",
            tariffCode: "TAR-00000001",
            tariffName: "Standard",
            quantity: 2,
            serviceDate: null,
            unitPrice: new Prisma.Decimal("100.00"),
            currency: "USD",
            amount: new Prisma.Decimal("200.00"),
            restrictionSnapshot: null,
            createdAt: new Date(),
            quoteId: "qte-1",
          },
        ],
        ...overrides,
      };
    }

    function makeIssuedQuoteDetail() {
      return {
        ...makeDraftQuote(),
        status: QuoteStatus.ISSUED,
        version: 2,
        issuedAt: new Date("2026-08-18T16:00:00Z"),
        subtotal: new Prisma.Decimal("200.00"),
        discountAmount: new Prisma.Decimal("0"),
        total: new Prisma.Decimal("200.00"),
        travelers: [],
      };
    }

    it("freezes Decimal totals and persists them at ISSUE", async () => {
      const draft = makeDraftQuote();
      const { service, prisma, commissionPolicies } = makeService();
      prisma.quote.findUnique.mockResolvedValue(draft);
      prisma.quote.findUniqueOrThrow.mockResolvedValue(draft);
      prisma.product.findMany.mockResolvedValue([{ partnerId: "par-1" }]);
      commissionPolicies.resolve.mockResolvedValue({ found: false, reason: "NO_POLICY" });
      // After tx, getQuoteDetail re-reads (second call with include)
      const postIssue = makeIssuedQuoteDetail();
      prisma.quote.findUnique
        .mockResolvedValueOnce(draft) // first: initial lookup
        .mockResolvedValueOnce(postIssue); // inside tx: findUniqueOrThrow
      // After tx: getQuoteDetail re-reads
      prisma.quote.findUnique.mockResolvedValueOnce(postIssue);

      await service.issueQuote("QTE-00000001", ACTOR);

      // Verify CAS update was called with frozen totals
      expect(prisma.quote.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: QuoteStatus.ISSUED,
            subtotal: expect.any(Prisma.Decimal),
            total: expect.any(Prisma.Decimal),
          }),
        }),
      );
      // Verify history + audit
      expect(prisma.quoteHistory.create).toHaveBeenCalled();
      expect((service as any).security ?? prisma).toBeDefined();
    });

    it("throws 422 when quote has no items", async () => {
      const emptyDraft = makeDraftQuote({ items: [] });
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue(emptyDraft);
      prisma.quote.findUniqueOrThrow.mockResolvedValue({ ...emptyDraft, items: [] });

      await expect(service.issueQuote("QTE-00000001", ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("throws 422 when quote has expired validUntil", async () => {
      const expiredDraft = makeDraftQuote({
        validUntil: new Date("2026-01-01T00:00:00Z"), // past
      });
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue(expiredDraft);
      prisma.quote.findUniqueOrThrow.mockResolvedValue(expiredDraft);

      await expect(service.issueQuote("QTE-00000001", ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("throws 422 on repeat ISSUE (terminal state)", async () => {
      const issuedDraft = makeDraftQuote({ status: QuoteStatus.ISSUED });
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue(issuedDraft);
      prisma.quote.findUniqueOrThrow.mockResolvedValue(issuedDraft);

      await expect(service.issueQuote("QTE-00000001", ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("throws 409 on stale version (concurrent modification)", async () => {
      const draft = makeDraftQuote({ version: 1 });
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue(draft);
      prisma.quote.findUniqueOrThrow.mockResolvedValue(draft);
      prisma.product.findMany.mockResolvedValue([{ partnerId: "par-1" }]);
      // CAS fails
      prisma.quote.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.issueQuote("QTE-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("computes commission snapshot from MARKETPLACE acquisition source", async () => {
      const draft = makeDraftQuote({ acquisitionSource: SalesAcquisitionSource.MARKETPLACE });
      const issuedDetail = makeIssuedQuoteDetail();
      const { service, prisma, commissionPolicies } = makeService();
      prisma.quote.findUnique.mockResolvedValueOnce(draft);
      prisma.quote.findUniqueOrThrow.mockResolvedValueOnce(draft);
      prisma.product.findMany.mockResolvedValue([{ partnerId: "par-1" }]);
      commissionPolicies.resolve.mockResolvedValue({
        found: true,
        policy: { code: "CMP-001", version: 1, rateType: "PERCENTAGE", rate: "0.15" },
      });
      prisma.quote.findUnique.mockResolvedValueOnce(issuedDetail);

      await service.issueQuote("QTE-00000001", ACTOR);

      expect(commissionPolicies.resolve).toHaveBeenCalledWith("MARKETPLACE", expect.any(String));
      // Verify commissionSnapshot was included in the update
      expect(prisma.quote.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            commissionSnapshot: expect.objectContaining({
              policyCode: "CMP-001",
              sellerPartnerId: "par-1",
            }),
          }),
        }),
      );
    });

    it("commissionSnapshot is null when acquisition source is not MARKETPLACE", async () => {
      const draft = makeDraftQuote({ acquisitionSource: SalesAcquisitionSource.DIRECT });
      const issuedDetail = makeIssuedQuoteDetail();
      const { service, prisma, commissionPolicies } = makeService();
      prisma.quote.findUnique
        .mockResolvedValueOnce(draft) // initial lookup
        .mockResolvedValueOnce(issuedDetail); // getQuoteDetail re-read
      prisma.quote.findUniqueOrThrow.mockResolvedValueOnce(draft);
      prisma.product.findMany.mockResolvedValue([]);

      await service.issueQuote("QTE-00000001", ACTOR);

      expect(commissionPolicies.resolve).not.toHaveBeenCalled();
      expect(prisma.quote.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            commissionSnapshot: Prisma.DbNull,
          }),
        }),
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * C. completeSale characterization
   *
   * Pins: CAS OPEN→CLOSED, commercial snapshot freeze, Catalog reservation
   * per item, outbox emit (retryable), history + audit, error guards.
   * ───────────────────────────────────────────────────────────────────────── */

  describe("C. completeSale characterization", () => {
    function makeOpenSale(overrides: Record<string, unknown> = {}) {
      return {
        id: "sal-1",
        code: "SAL-00000001",
        status: SaleStatus.OPEN,
        version: 1,
        checkoutIntentId: "ckt-1",
        customerId: "cus-1",
        quoteId: "qte-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      };
    }

    function makeActiveCheckout(overrides: Record<string, unknown> = {}) {
      return {
        id: "ckt-1",
        code: "CKT-00000001",
        quoteId: "qte-1",
        status: CheckoutStatus.ACTIVE,
        currency: "USD",
        subtotal: new Prisma.Decimal("200.00"),
        total: new Prisma.Decimal("200.00"),
        discountType: QuoteDiscountType.NONE,
        discountValue: null,
        discountAmount: null,
        paymentScheme: PaymentScheme.FULL_PREPAYMENT,
        prepaymentType: null,
        prepaymentValue: null,
        initialAmount: new Prisma.Decimal("200.00"),
        remainingAmount: new Prisma.Decimal("0"),
        acquisitionSource: SalesAcquisitionSource.DIRECT,
        commissionSnapshot: null,
        serviceDate: new Date("2026-09-01T00:00:00Z"),
        serviceTime: null,
        serviceEndTime: null,
        serviceTimeZone: null,
        customerId: "cus-1",
        ...overrides,
      };
    }

    function makeIssuedQuoteWithItems() {
      return {
        id: "qte-1",
        code: "QTE-00000001",
        status: QuoteStatus.ISSUED,
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            productCode: "PRD-00000001",
            productTitle: "Hotel",
            tariffId: "tar-1",
            tariffCode: "TAR-00000001",
            quantity: 2,
            unitPrice: new Prisma.Decimal("100.00"),
            amount: new Prisma.Decimal("200.00"),
            currency: "USD",
            createdAt: new Date(),
            quoteId: "qte-1",
          },
        ],
      };
    }

    it("completes sale: CAS OPEN→CLOSED, reserveAvailability per item, outbox emit, publishEvent post-commit", async () => {
      const { service, prisma, catalog, eventBus } = makeService();
      const sale = makeOpenSale();
      const checkout = makeActiveCheckout();
      const quote = makeIssuedQuoteWithItems();
      const productTypeRow = [{ id: "prod-1", type: "HOTEL" }];

      prisma.sale.findUnique.mockResolvedValue(sale);
      prisma.checkoutIntent.findUnique.mockResolvedValue(checkout);
      prisma.quote.findUnique.mockResolvedValue(quote);
      prisma.product.findMany.mockResolvedValue(productTypeRow);

      const result = await service.completeSale("SAL-00000001", 1, ACTOR);

      // Verify CAS: status OPEN → CLOSED
      expect(prisma.sale.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "sal-1", version: 1, status: SaleStatus.OPEN }),
          data: expect.objectContaining({ status: SaleStatus.CLOSED }),
        }),
      );

      // Verify reservation per item (1 item → 1 call)
      expect(catalog.reserveAvailability).toHaveBeenCalledTimes(1);
      expect(catalog.reserveAvailability).toHaveBeenCalledWith(
        expect.anything(), // tx
        expect.objectContaining({ productId: "prod-1", tariffId: "tar-1", quantity: 2 }),
      );

      // Verify outbox emit (retryable)
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.anything(), // tx
        expect.objectContaining({
          aggregateType: "Sale",
          eventType: "OrderRequested",
          retryable: true,
        }),
      );

      // Verify post-commit delivery
      expect(eventBus.publishEvent).toHaveBeenCalledTimes(1);
      expect(eventBus.publishEvent).toHaveBeenCalledWith("evt-1");

      // Verify history + audit
      expect(prisma.saleHistory.create).toHaveBeenCalled();

      // Verify result shape
      expect(result.status).toBe(SaleStatus.CLOSED);
      expect(result.saleCode).toBe("SAL-00000001");
      expect(result.reservations).toEqual(["RES-00000001"]);
    });

    it("throws 409 when sale is already CLOSED (non-OPEN)", async () => {
      const { service, prisma } = makeService();
      const closedSale = makeOpenSale({ status: SaleStatus.CLOSED });
      prisma.sale.findUnique.mockResolvedValue(closedSale);

      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow(ConflictError);
    });

    it("throws 422 when sale has no checkoutIntentId", async () => {
      const { service, prisma } = makeService();
      const saleNoCheckout = makeOpenSale({ checkoutIntentId: null });
      prisma.sale.findUnique.mockResolvedValue(saleNoCheckout);

      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("throws 409 on stale version (CAS fails)", async () => {
      const { service, prisma, eventBus } = makeService();
      const sale = makeOpenSale({ version: 2 });
      prisma.sale.findUnique.mockResolvedValue(sale);
      prisma.checkoutIntent.findUnique.mockResolvedValue(makeActiveCheckout());
      prisma.quote.findUnique.mockResolvedValue(makeIssuedQuoteWithItems());
      prisma.product.findMany.mockResolvedValue([{ id: "prod-1", type: "HOTEL" }]);
      // CAS fails
      prisma.sale.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow(ConflictError);

      // No reservation or event on stale version
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it("throws 422 when checkout has no payment terms", async () => {
      const { service, prisma } = makeService();
      const checkoutNoTerms = makeActiveCheckout({
        paymentScheme: null,
        initialAmount: null,
        remainingAmount: null,
      });
      prisma.sale.findUnique.mockResolvedValue(makeOpenSale());
      prisma.checkoutIntent.findUnique.mockResolvedValue(checkoutNoTerms);

      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("throws 422 when checkout has no service date", async () => {
      const { service, prisma } = makeService();
      const checkoutNoDate = makeActiveCheckout({ serviceDate: null });
      prisma.sale.findUnique.mockResolvedValue(makeOpenSale());
      prisma.checkoutIntent.findUnique.mockResolvedValue(checkoutNoDate);

      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("throws 422 when checkout is cancelled (assertCheckoutMutable)", async () => {
      const { service, prisma } = makeService();
      const sale = makeOpenSale();
      const cancelledCheckout = makeActiveCheckout({ status: CheckoutStatus.CANCELLED });
      prisma.sale.findUnique.mockResolvedValue(sale);
      prisma.checkoutIntent.findUnique.mockResolvedValue(cancelledCheckout);

      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow(ValidationDomainError);
    });

    it("publishEvent is called AFTER commit (not rolled back on delivery failure)", async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.sale.findUnique.mockResolvedValue(makeOpenSale());
      prisma.checkoutIntent.findUnique.mockResolvedValue(makeActiveCheckout());
      prisma.quote.findUnique.mockResolvedValue(makeIssuedQuoteWithItems());
      prisma.product.findMany.mockResolvedValue([{ id: "prod-1", type: "HOTEL" }]);
      // publishEvent fails
      eventBus.publishEvent.mockRejectedValue(new Error("delivery failed"));

      // completeSale should throw from publishEvent failure, but the tx already committed
      await expect(service.completeSale("SAL-00000001", 1, ACTOR)).rejects.toThrow("delivery failed");

      // emit was called (tx committed)
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
    });
  });
});
