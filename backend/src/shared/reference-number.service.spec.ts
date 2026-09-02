import { ReferenceNumberService } from "./reference-number.service";

/** Prisma mock — only BusinessSequence upsert needed for allocator. */
function makePrismaMock() {
  const seq = new Map<string, number>();
  return {
    seqClient: {
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          businessSequence: {
            upsert: jest.fn(async (args: any) => {
              const prefix = args.where.prefix;
              const current = seq.get(prefix) ?? 0;
              const newVal = current + args.update.value.increment;
              seq.set(prefix, newVal);
              return { prefix, value: newVal };
            }),
          },
        };
        return fn(tx);
      }),
    },
  } as any;
}

describe("ReferenceNumberService — Tenant-Scoped Reference Number Contract", () => {
  let service: ReferenceNumberService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ReferenceNumberService(prisma);
  });

  // ── Marketplace references ────────────────────────────────────────────

  describe("Marketplace references", () => {
    it("MKT + ORD → MKT-ORD-{SEQ}", async () => {
      const ref = await service.nextMarketplaceReference(null as any, "ORD");
      expect(ref).toBe("MKT-ORD-00000001");
    });

    it("MKT + BKG → MKT-BKG-{SEQ}", async () => {
      const ref = await service.nextMarketplaceReference(null as any, "BKG");
      expect(ref).toBe("MKT-BKG-00000001");
    });

    it("MKT + PAY → MKT-PAY-{SEQ}", async () => {
      const ref = await service.nextMarketplaceReference(null as any, "PAY");
      expect(ref).toBe("MKT-PAY-00000001");
    });

    it("MKT + REF → MKT-REF-{SEQ}", async () => {
      const ref = await service.nextMarketplaceReference(null as any, "REF");
      expect(ref).toBe("MKT-REF-00000001");
    });

    it("MKT + INV → MKT-INV-{SEQ}", async () => {
      const ref = await service.nextMarketplaceReference(null as any, "INV");
      expect(ref).toBe("MKT-INV-00000001");
    });

    it("sequent calls increment sequence", async () => {
      const r1 = await service.nextMarketplaceReference(null as any, "ORD");
      const r2 = await service.nextMarketplaceReference(null as any, "ORD");
      const r3 = await service.nextMarketplaceReference(null as any, "ORD");
      expect(r1).toBe("MKT-ORD-00000001");
      expect(r2).toBe("MKT-ORD-00000002");
      expect(r3).toBe("MKT-ORD-00000003");
    });
  });

  // ── Storefront references ─────────────────────────────────────────────

  describe("Storefront references", () => {
    it("SF001 + ORD → SF001-ORD-{SEQ}", async () => {
      const ref = await service.nextStorefrontReference(null as any, "SF001", "ORD");
      expect(ref).toBe("SF001-ORD-00000001");
    });

    it("SF001 + BKG → SF001-BKG-{SEQ}", async () => {
      const ref = await service.nextStorefrontReference(null as any, "SF001", "BKG");
      expect(ref).toBe("SF001-BKG-00000001");
    });

    it("SF001 + PAY → SF001-PAY-{SEQ}", async () => {
      const ref = await service.nextStorefrontReference(null as any, "SF001", "PAY");
      expect(ref).toBe("SF001-PAY-00000001");
    });

    it("SF001 + REF → SF001-REF-{SEQ}", async () => {
      const ref = await service.nextStorefrontReference(null as any, "SF001", "REF");
      expect(ref).toBe("SF001-REF-00000001");
    });

    it("SF001 ORD and BKG have independent sequences", async () => {
      const r1 = await service.nextStorefrontReference(null as any, "SF001", "ORD");
      const r2 = await service.nextStorefrontReference(null as any, "SF001", "BKG");
      expect(r1).toBe("SF001-ORD-00000001");
      expect(r2).toBe("SF001-BKG-00000001");
    });
  });

  // ── Tenant sequence separation ────────────────────────────────────────

  describe("Tenant sequence separation", () => {
    it("SF001 and SF002 ORD sequences are independent", async () => {
      const sf001_r1 = await service.nextStorefrontReference(null as any, "SF001", "ORD");
      const sf002_r1 = await service.nextStorefrontReference(null as any, "SF002", "ORD");
      const sf001_r2 = await service.nextStorefrontReference(null as any, "SF001", "ORD");
      const sf002_r2 = await service.nextStorefrontReference(null as any, "SF002", "ORD");

      expect(sf001_r1).toBe("SF001-ORD-00000001");
      expect(sf002_r1).toBe("SF002-ORD-00000001");
      expect(sf001_r2).toBe("SF001-ORD-00000002");
      expect(sf002_r2).toBe("SF002-ORD-00000002");
    });

    it("Marketplace and Storefront sequences are independent", async () => {
      const mkt = await service.nextMarketplaceReference(null as any, "ORD");
      const sf = await service.nextStorefrontReference(null as any, "SF001", "ORD");
      expect(mkt).toBe("MKT-ORD-00000001");
      expect(sf).toBe("SF001-ORD-00000001");
    });

    it("all generated references across tenants are unique", async () => {
      const refs = new Set<string>();
      for (let i = 0; i < 10; i++) {
        refs.add(await service.nextMarketplaceReference(null as any, "ORD"));
        refs.add(await service.nextStorefrontReference(null as any, "SF001", "ORD"));
        refs.add(await service.nextStorefrontReference(null as any, "SF002", "ORD"));
        refs.add(await service.nextStorefrontReference(null as any, "SF003", "ORD"));
      }
      expect(refs.size).toBe(40); // 10 per tenant × 4 tenants
    });
  });

  // ── Entity-type sequence separation ───────────────────────────────────

  describe("Entity-type sequence separation", () => {
    it("ORD, BKG, PAY, REF have independent sequences within same tenant", async () => {
      const refs: string[] = [];
      for (const type of ["ORD", "BKG", "PAY", "REF"]) {
        refs.push(await service.nextStorefrontReference(null as any, "SF001", type));
      }
      expect(refs).toEqual([
        "SF001-ORD-00000001",
        "SF001-BKG-00000001",
        "SF001-PAY-00000001",
        "SF001-REF-00000001",
      ]);
    });
  });

  // ── SaaS references ───────────────────────────────────────────────────

  describe("SaaS references", () => {
    it("SAAS-SF001-INV → SAAS-SF001-INV-{SEQ}", async () => {
      const ref = await service.nextSaasReference(null as any, "SF001", "INV");
      expect(ref).toBe("SAAS-SF001-INV-00000001");
    });

    it("SAAS-SF001-PAY → SAAS-SF001-PAY-{SEQ}", async () => {
      const ref = await service.nextSaasReference(null as any, "SF001", "PAY");
      expect(ref).toBe("SAAS-SF001-PAY-00000001");
    });
  });

  // ── Direct allocation ─────────────────────────────────────────────────

  describe("nextReferenceNumber direct call", () => {
    it("respects custom prefix and digits", async () => {
      const ref = await service.nextReferenceNumber(null as any, "CUSTOM", "ORD", 4);
      expect(ref).toBe("CUSTOM-ORD-0001");
    });

    it("respects custom digits (10)", async () => {
      const ref = await service.nextReferenceNumber(null as any, "MKT", "ORD", 10);
      expect(ref).toBe("MKT-ORD-0000000001");
    });
  });

  // ── Block allocation ──────────────────────────────────────────────────

  describe("Hi/Lo block allocation", () => {
    it("allocates from block without hitting DB each time", async () => {
      // First call triggers block claim
      const r1 = await service.nextMarketplaceReference(null as any, "ORD");
      expect(r1).toBe("MKT-ORD-00000001");

      // Next 99 calls should come from cache (no additional DB calls)
      for (let i = 2; i <= 100; i++) {
        const r = await service.nextMarketplaceReference(null as any, "ORD");
        expect(r).toBe(`MKT-ORD-${String(i).padStart(8, "0")}`);
      }

      // Only 1 DB call (block size = 100)
      expect(prisma.seqClient.$transaction).toHaveBeenCalledTimes(1);
    });

    it("claims new block after exhausting current block", async () => {
      // Exhaust first block (100)
      for (let i = 1; i <= 100; i++) {
        await service.nextMarketplaceReference(null as any, "ORD");
      }
      expect(prisma.seqClient.$transaction).toHaveBeenCalledTimes(1);

      // 101st call triggers new block
      const r = await service.nextMarketplaceReference(null as any, "ORD");
      expect(r).toBe("MKT-ORD-00000101");
      expect(prisma.seqClient.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  // ── Negative: SF000 not silently emitted ──────────────────────────────

  describe("SF000 prevention", () => {
    it("nextStorefrontReference with explicit SF000 prefix emits SF000 (caller responsibility)", async () => {
      // The service itself doesn't prevent SF000 — it's the caller's job
      // to resolve the correct storefrontCode. If caller passes SF000, it emits SF000.
      // This test documents that behavior.
      const ref = await service.nextStorefrontReference(null as any, "SF000", "ORD");
      expect(ref).toBe("SF000-ORD-00000001");
    });
  });
});
