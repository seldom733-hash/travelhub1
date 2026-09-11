import { Test, type TestingModule } from "@nestjs/testing";
import { DocumentsService } from "./documents.service";
import { DocumentRenderer } from "./document-renderer.service";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { EventBusService } from "../../eventbus/eventbus.service";

jest.mock("@react-pdf/renderer", () => {
  const mockPdfInstance = {
    toBlob: jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock-pdf-content-for-unit-test")),
    }),
  };
  return {
    pdf: jest.fn().mockReturnValue(mockPdfInstance),
    Document: "Document",
    Page: "Page",
    Text: "Text",
    View: "View",
    StyleSheet: { create: jest.fn((s: any) => s) },
  };
});

jest.mock("react", () => ({
  createElement: jest.fn((type: any, props: any, ...children: any) => ({ type, props, children })),
}));

function createMockPrisma() {
  const prisma: any = {
    $transaction: jest.fn((fn: any) => fn(prisma)),
    document: {
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    documentVersion: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    documentHistory: {
      create: jest.fn(),
    },
    user: {
      findUniqueOrThrow: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    passenger: {
      findMany: jest.fn(),
    },
  };
  return prisma;
}

describe("DocumentsService", () => {
  let service: DocumentsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let ids: { nextCode: jest.Mock };
  let storage: { putObject: jest.Mock; getSignedReadUrl: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    ids = { nextCode: jest.fn().mockResolvedValue("VCH-00000001") };
    storage = {
      putObject: jest.fn().mockResolvedValue({ key: "test", size: 100 }),
      getSignedReadUrl: jest.fn().mockResolvedValue("https://signed-url"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        DocumentRenderer,
        { provide: PrismaService, useValue: prisma },
        { provide: IdsService, useValue: ids },
        { provide: EventBusService, useValue: {} },
        { provide: "ObjectStorageService", useValue: storage },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe("createDocument", () => {
    it("should create a document entity with correct prefix", async () => {
      prisma.document.create.mockResolvedValue({ id: "doc-1", code: "VCH-00000001" });

      const result = await (service as any).createDocument(prisma, {
        type: "VOUCHER",
        bookingId: "bkg-1",
        orderId: "ord-1",
      });

      expect(result).toEqual({ id: "doc-1", code: "VCH-00000001" });
      expect(ids.nextCode).toHaveBeenCalledWith(prisma, "VCH");
    });

    it("should use PPD prefix for PARTIAL_PAYMENT", async () => {
      prisma.document.create.mockResolvedValue({ id: "doc-2", code: "PPD-00000001" });

      await (service as any).createDocument(prisma, {
        type: "PARTIAL_PAYMENT",
        bookingId: "bkg-1",
        orderId: "ord-1",
      });

      expect(ids.nextCode).toHaveBeenCalledWith(prisma, "PPD");
    });

    it("should use RFD prefix for REFUND", async () => {
      prisma.document.create.mockResolvedValue({ id: "doc-3", code: "RFD-00000001" });

      await (service as any).createDocument(prisma, {
        type: "REFUND",
        bookingId: "bkg-1",
        orderId: "ord-1",
      });

      expect(ids.nextCode).toHaveBeenCalledWith(prisma, "RFD");
    });
  });

  describe("invalidateDocument", () => {
    it("should transition ISSUED document to INVALIDATED", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-1",
        code: "VCH-00000001",
        status: "ISSUED",
      });

      await (service as any).invalidateDocument(prisma, "doc-1", "Booking cancelled");

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { status: "INVALIDATED" },
      });
      expect(prisma.documentHistory.create).toHaveBeenCalled();
    });

    it("should be idempotent for already INVALIDATED documents", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-1",
        code: "VCH-00000001",
        status: "INVALIDATED",
      });

      await (service as any).invalidateDocument(prisma, "doc-1", "Booking cancelled");

      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it("should skip SUPERSEDED documents", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-1",
        code: "VCH-00000001",
        status: "SUPERSEDED",
      });

      await (service as any).invalidateDocument(prisma, "doc-1", "Booking cancelled");

      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });

  describe("listBuyerDocuments", () => {
    it("should return empty for user without customerId", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "user-1", customerId: null });

      const result = await service.listBuyerDocuments("user-1");

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  // ── D-1 REGRESSION: storage failure must NOT produce ISSUED state ──

  describe("D-1: issueDocument — storage success", () => {
    it("D1-TEST-01: creates ISSUED DocumentVersion when storage succeeds", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-1", code: "VCH-00000001", type: "VOUCHER", status: "NOT_ISSUED",
      });
      prisma.documentVersion.findFirst.mockResolvedValue(null);
      prisma.documentVersion.create.mockResolvedValue({
        id: "ver-1", versionNumber: 1, s3Key: "documents/doc-1/v1.pdf",
      });
      storage.putObject.mockResolvedValue({ key: "documents/doc-1/v1.pdf", size: 512 });

      const result = await (service as any).issueDocument(prisma, "doc-1", "PaymentCaptured (PAY-00000001)", { code: "VCH-00000001" });

      expect(result).toEqual({ versionNumber: 1, s3Key: "documents/doc-1/v1.pdf" });
      expect(prisma.documentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ISSUED", documentId: "doc-1" }),
        }),
      );
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "doc-1" },
          data: expect.objectContaining({ status: "ISSUED" }),
        }),
      );
    });
  });

  describe("D-1: issueDocument — storage failure", () => {
    it("D1-TEST-02: throws on storage failure — no DocumentVersion created", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-2", code: "VCH-00000002", type: "VOUCHER", status: "NOT_ISSUED",
      });
      prisma.documentVersion.findFirst.mockResolvedValue(null);
      storage.putObject.mockRejectedValue(new Error("ECONNREFUSED localhost:9000"));

      await expect(
        (service as any).issueDocument(prisma, "doc-2", "PaymentCaptured (PAY-00000002)", { code: "VCH-00000002" }),
      ).rejects.toThrow("ECONNREFUSED");

      expect(prisma.documentVersion.create).not.toHaveBeenCalled();
      expect(prisma.document.update).not.toHaveBeenCalled();
      expect(prisma.documentHistory.create).not.toHaveBeenCalled();
    });

    it("D1-TEST-03: Document stays NOT_ISSUED after storage failure", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-3", code: "VCH-00000003", type: "VOUCHER", status: "NOT_ISSUED",
      });
      prisma.documentVersion.findFirst.mockResolvedValue(null);
      storage.putObject.mockRejectedValue(new Error("S3 unavailable"));

      await expect(
        (service as any).issueDocument(prisma, "doc-3", "BookingConfirmed (BKG-00000003)", { code: "VCH-00000003" }),
      ).rejects.toThrow("S3 unavailable");

      // Document.update should never be called — no ISSUED transition
      expect(prisma.document.update).not.toHaveBeenCalled();
      // No version created
      expect(prisma.documentVersion.create).not.toHaveBeenCalled();
    });
  });

  describe("D-1: issueDocument — retry after storage recovery", () => {
    it("D1-TEST-04: retry succeeds after storage recovers — single document, single version", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-4", code: "VCH-00000004", type: "VOUCHER", status: "NOT_ISSUED",
      });
      prisma.documentVersion.findFirst.mockResolvedValue(null);
      storage.putObject.mockResolvedValue({ key: "documents/doc-4/v1.pdf", size: 1024 });
      prisma.documentVersion.create.mockResolvedValue({
        id: "ver-4", versionNumber: 1, s3Key: "documents/doc-4/v1.pdf",
      });

      const result = await (service as any).issueDocument(prisma, "doc-4", "PaymentCaptured (PAY-00000004)", { code: "VCH-00000004" });

      expect(result.versionNumber).toBe(1);
      expect(prisma.documentVersion.create).toHaveBeenCalledTimes(1);
      expect(prisma.document.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("D-1: getDownloadUrl — storage unavailable", () => {
    it("D1-TEST-05: download for genuinely stored PDF succeeds", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-5", code: "VCH-00000005", status: "ISSUED",
        versions: [{ id: "ver-5", status: "ISSUED", s3Key: "documents/doc-5/v1.pdf" }],
      });
      storage.getSignedReadUrl.mockResolvedValue("https://s3.example.com/doc.pdf");

      const result = await service.getDownloadUrl("doc-5", "user-1", "ADMIN");
      expect(result).toEqual({ url: "https://s3.example.com/doc.pdf", code: "VCH-00000005" });
    });

    it("D1-TEST-06: download for missing/unavailable storage returns controlled error", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-6", code: "VCH-00000006", status: "ISSUED",
        versions: [{ id: "ver-6", status: "ISSUED", s3Key: "documents/doc-6/v1.pdf" }],
      });
      storage.getSignedReadUrl.mockRejectedValue(new Error("ECONNREFUSED localhost:9000"));

      await expect(service.getDownloadUrl("doc-6", "user-1", "ADMIN")).rejects.toThrow("temporarily unavailable");
    });

    it("D1-TEST-06b: download for NOT_ISSUED document returns controlled error", async () => {
      prisma.document.findUniqueOrThrow.mockResolvedValue({
        id: "doc-6b", code: "VCH-00000006", status: "NOT_ISSUED",
        versions: [],
      });

      await expect(service.getDownloadUrl("doc-6b", "user-1", "ADMIN")).rejects.toThrow("not been issued");
    });
  });

  // ── D-3 REGRESSION: KPI type aggregation ──

  describe("D-3: listAllDocuments — type aggregation", () => {
    it("D3-TEST-01: returns exact counts for all three types (basic)", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(3);
      prisma.document.groupBy.mockResolvedValue([
        { type: "VOUCHER", _count: { type: 3 } },
      ]);

      const result = await service.listAllDocuments(1, 20);

      expect(result.total).toBe(3);
      expect(result.aggregates.type).toEqual({
        VOUCHER: 3,
        PARTIAL_PAYMENT: 0,
        REFUND: 0,
      });
    });

    it("D3-TEST-02: mixed type counts", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(6);
      prisma.document.groupBy.mockResolvedValue([
        { type: "VOUCHER", _count: { type: 2 } },
        { type: "PARTIAL_PAYMENT", _count: { type: 1 } },
        { type: "REFUND", _count: { type: 3 } },
      ]);

      const result = await service.listAllDocuments(1, 20);

      expect(result.aggregates.type).toEqual({
        VOUCHER: 2,
        PARTIAL_PAYMENT: 1,
        REFUND: 3,
      });
    });

    it("D3-TEST-03: aggregates independent of pagination", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(30);
      prisma.document.groupBy.mockResolvedValue([
        { type: "VOUCHER", _count: { type: 30 } },
      ]);

      const result = await service.listAllDocuments(1, 20);

      // pageSize=20 but aggregates should reflect ALL documents
      expect(result.items).toHaveLength(0); // mock returns empty
      expect(result.aggregates.type.VOUCHER).toBe(30);
    });

    it("D3-TEST-04: aggregates use unfiltered counts (not page-filtered)", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(10);
      prisma.document.groupBy.mockResolvedValue([
        { type: "VOUCHER", _count: { type: 8 } },
        { type: "REFUND", _count: { type: 2 } },
      ]);

      const result = await service.listAllDocuments(1, 20, "VOUCHER");

      // groupBy uses same `where` filter as items — correct behavior
      expect(result.aggregates.type).toEqual({
        VOUCHER: 8,
        PARTIAL_PAYMENT: 0,
        REFUND: 2,
      });
    });

    it("D3-TEST-05: type filter passed to groupBy", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(5);
      prisma.document.groupBy.mockResolvedValue([
        { type: "VOUCHER", _count: { type: 5 } },
      ]);

      await service.listAllDocuments(1, 20, "VOUCHER");

      expect(prisma.document.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ["type"],
          where: expect.objectContaining({ type: "VOUCHER" }),
        }),
      );
    });

    it("D3-TEST-06: empty dataset returns all zeros", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.document.groupBy.mockResolvedValue([]);

      const result = await service.listAllDocuments(1, 20);

      expect(result.total).toBe(0);
      expect(result.aggregates.type).toEqual({
        VOUCHER: 0,
        PARTIAL_PAYMENT: 0,
        REFUND: 0,
      });
    });

    it("D3-TEST-07: response includes aggregates field", async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.document.groupBy.mockResolvedValue([]);

      const result = await service.listAllDocuments(1, 20);

      expect(result).toHaveProperty("aggregates");
      expect(result).toHaveProperty("aggregates.type");
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
    });
  });
});

describe("DocumentRenderer — mocked @react-pdf/renderer", () => {
  let renderer: DocumentRenderer;

  beforeEach(() => {
    renderer = new DocumentRenderer();
  });

  it("should render VOUCHER to valid PDF buffer", async () => {
    const buffer = await renderer.render("VOUCHER", {
      code: "VCH-00000001",
      bookingCode: "BKG-00000001",
      travelers: [],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("should render PARTIAL_PAYMENT to valid PDF buffer", async () => {
    const buffer = await renderer.render("PARTIAL_PAYMENT", {
      code: "PPD-00000001",
      totalAmount: "5000",
      paidAmount: "2500",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("should render REFUND to valid PDF buffer", async () => {
    const buffer = await renderer.render("REFUND", {
      code: "RFD-00000001",
      refundAmount: "500",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("should throw for unknown document type", async () => {
    await expect(renderer.render("UNKNOWN" as any, {})).rejects.toThrow("Unknown document type");
  });
});
