/**
 * Step 3.29D — Storefront Billing Service Unit Tests
 */

// Hoisted mock — jest.mock factory runs before imports
const mockPrisma: any = {
  subscriptionContract: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  subscriptionInvoice: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  subscriptionPayment: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  storefrontSubscription: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

jest.mock("../../../generated/prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
    Prisma: {
      Decimal: jest.fn().mockImplementation((v: any) => ({
        mul: (q: number) => Number(v) * q,
      })),
      sql: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => ({ strings, values })),
      raw: jest.fn((s: string) => s),
    },
  };
});

import { StorefrontBillingService } from "./storefront-billing.service";

describe("StorefrontBillingService", () => {
  let service: StorefrontBillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorefrontBillingService();
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  // ─── CONTRACT ────────────────────────────────────────────────────────

  describe("createContract", () => {
    it("creates contract with correct fields", async () => {
      mockPrisma.subscriptionContract.create.mockResolvedValue({
        id: "c1", code: "SC-00000001", contractedUnitAmount: 169,
        currency: "AZN", quantity: 2, contractedTotalAmount: 338,
      });

      const contract = await service.createContract({
        subscriptionId: "s1", planId: "p1", contractedUnitAmount: 169, quantity: 2,
      });

      expect(contract.contractedUnitAmount).toBe(169);
      expect(contract.currency).toBe("AZN");
      expect(contract.quantity).toBe(2);
    });

    it("defaults to quantity=1 and currency=AZN", async () => {
      mockPrisma.subscriptionContract.create.mockResolvedValue({});
      await service.createContract({ subscriptionId: "s1", planId: "p1", contractedUnitAmount: 199 });
      const data = mockPrisma.subscriptionContract.create.mock.calls[0][0].data;
      expect(data.quantity).toBe(1);
      expect(data.currency).toBe("AZN");
    });
  });

  // ─── INVOICE ─────────────────────────────────────────────────────────

  describe("generateInvoice", () => {
    it("generates invoice from contract snapshot", async () => {
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionContract.findUniqueOrThrow.mockResolvedValue({
        id: "c1", subscriptionId: "s1", contractedTotalAmount: 199, currency: "AZN",
      });
      mockPrisma.subscriptionInvoice.create.mockResolvedValue({
        id: "inv1", totalAmount: 199, status: "OPEN",
      });

      const result = await service.generateInvoice("c1", new Date("2026-01-01"), new Date("2026-02-01"));
      expect(result.idempotent).toBe(false);
      expect(result.invoice.totalAmount).toBe(199);
    });

    it("returns existing invoice on duplicate period (idempotent)", async () => {
      const existing = { id: "inv-existing", totalAmount: 199 };
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(existing);
      const result = await service.generateInvoice("c1", new Date("2026-01-01"), new Date("2026-02-01"));
      expect(result.idempotent).toBe(true);
      expect(result.invoice).toBe(existing);
      expect(mockPrisma.subscriptionInvoice.create).not.toHaveBeenCalled();
    });
  });

  // ─── PAYMENT ─────────────────────────────────────────────────────────

  describe("recordPayment", () => {
    it("records successful payment and marks invoice paid", async () => {
      mockPrisma.subscriptionInvoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv1", code: "SINV-00000001", status: "OPEN", currency: "AZN", totalAmount: 199,
      });
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.subscriptionPayment.create.mockResolvedValue({ id: "pay1", amount: 199, status: "SUCCEEDED" });
      mockPrisma.subscriptionInvoice.update.mockResolvedValue({});

      const result = await service.recordPayment("inv1", 199, "AZN");
      expect(result.invoicePaid).toBe(true);
    });

    it("rejects payment on non-OPEN invoice", async () => {
      mockPrisma.subscriptionInvoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv1", code: "SINV-00000001", status: "PAID", currency: "AZN", totalAmount: 199,
      });
      await expect(service.recordPayment("inv1", 199, "AZN")).rejects.toThrow("not OPEN");
    });

    it("rejects currency mismatch", async () => {
      mockPrisma.subscriptionInvoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv1", code: "SINV-00000001", status: "OPEN", currency: "AZN", totalAmount: 199,
      });
      await expect(service.recordPayment("inv1", 199, "USD")).rejects.toThrow("Currency mismatch");
    });

    it("rejects overpayment", async () => {
      mockPrisma.subscriptionInvoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv1", code: "SINV-00000001", status: "OPEN", currency: "AZN", totalAmount: 199,
      });
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: 100 } });
      await expect(service.recordPayment("inv1", 150, "AZN")).rejects.toThrow("Overpayment");
    });

    it("allows partial payment", async () => {
      mockPrisma.subscriptionInvoice.findUniqueOrThrow.mockResolvedValue({
        id: "inv1", code: "SINV-00000001", status: "OPEN", currency: "AZN", totalAmount: 199,
      });
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.subscriptionPayment.create.mockResolvedValue({ id: "pay1", amount: 100 });
      const result = await service.recordPayment("inv1", 100, "AZN");
      expect(result.invoicePaid).toBe(false);
    });
  });

  // ─── TRIAL → PAID ──────────────────────────────────────────────────

  describe("convertTrialToPaid", () => {
    it("converts trial to active with new contract", async () => {
      mockPrisma.storefrontSubscription.findUniqueOrThrow.mockResolvedValue({ id: "s1", status: "TRIAL" });
      mockPrisma.subscriptionContract.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionContract.create.mockResolvedValue({ id: "c1", contractedUnitAmount: 199 });
      mockPrisma.storefrontSubscription.update.mockResolvedValue({});

      const contract = await service.convertTrialToPaid("s1", "p2", 199);
      expect(contract.contractedUnitAmount).toBe(199);
    });

    it("rejects conversion for cancelled subscription", async () => {
      mockPrisma.storefrontSubscription.findUniqueOrThrow.mockResolvedValue({ id: "s1", status: "CANCELLED" });
      await expect(service.convertTrialToPaid("s1", "p2", 199)).rejects.toThrow("CANCELLED");
    });
  });

  // ─── CANCELLATION ───────────────────────────────────────────────────

  describe("cancelSubscription", () => {
    it("cancels active subscription and deactivates contract", async () => {
      mockPrisma.storefrontSubscription.findUniqueOrThrow.mockResolvedValue({ id: "s1", status: "ACTIVE" });
      mockPrisma.subscriptionContract.findFirst.mockResolvedValue({ id: "c1", isActive: true });
      mockPrisma.subscriptionContract.update.mockResolvedValue({});
      mockPrisma.storefrontSubscription.update.mockResolvedValue({ status: "CANCELLED" });

      const result = await service.cancelSubscription("s1");
      expect(result.status).toBe("CANCELLED");
    });

    it("rejects double cancellation", async () => {
      mockPrisma.storefrontSubscription.findUniqueOrThrow.mockResolvedValue({ id: "s1", status: "CANCELLED" });
      await expect(service.cancelSubscription("s1")).rejects.toThrow("already CANCELLED");
    });
  });

  // ─── RENEWAL ────────────────────────────────────────────────────────

  describe("renewSubscription", () => {
    it("generates next period invoice for active subscription", async () => {
      mockPrisma.storefrontSubscription.findUniqueOrThrow.mockResolvedValue({
        id: "s1", status: "ACTIVE", currentPeriodEnd: new Date("2026-02-01"),
      });
      mockPrisma.subscriptionContract.findFirst.mockResolvedValue({
        id: "c1", contractedTotalAmount: 199, currency: "AZN",
      });
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionContract.findUniqueOrThrow.mockResolvedValue({
        id: "c1", subscriptionId: "s1", contractedTotalAmount: 199, currency: "AZN",
      });
      mockPrisma.subscriptionInvoice.create.mockResolvedValue({ id: "inv2", totalAmount: 199 });
      mockPrisma.storefrontSubscription.update.mockResolvedValue({});

      const result = await service.renewSubscription("s1");
      expect(result).not.toBeNull();
      expect(result!.invoice.totalAmount).toBe(199);
    });

    it("returns null for non-active subscription", async () => {
      mockPrisma.storefrontSubscription.findUniqueOrThrow.mockResolvedValue({ id: "s1", status: "CANCELLED" });
      const result = await service.renewSubscription("s1");
      expect(result).toBeNull();
    });
  });
});
