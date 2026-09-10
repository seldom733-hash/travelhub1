import { Test, type TestingModule } from "@nestjs/testing";
import { DocumentsService } from "./documents.service";
import { DocumentRenderer } from "./document-renderer.service";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { EventBusService } from "../../eventbus/eventbus.service";

jest.mock("pdf-lib", () => {
  const mockPage = {
    getSize: () => ({ width: 595.28, height: 841.89 }),
    drawLine: jest.fn(),
    drawText: jest.fn(),
  };
  const mockDoc = {
    addPage: jest.fn(() => mockPage),
    embedFont: jest.fn().mockResolvedValue("mock-font"),
    save: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from("%PDF-1.4 mock-pdf-content-for-unit-test"))),
  };
  return {
    PDFDocument: { create: jest.fn().mockResolvedValue(mockDoc) },
    StandardFonts: { Helvetica: "Helvetica", HelveticaBold: "HelveticaBold", HelveticaOblique: "HelveticaOblique" },
    rgb: jest.fn(() => ({})),
  };
});

function createMockPrisma() {
  const prisma: any = {
    $transaction: jest.fn((fn: any) => fn(prisma)),
    document: {
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
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
});

describe("DocumentRenderer — unit (mocked PDF)", () => {
  let renderer: DocumentRenderer;

  beforeEach(() => {
    renderer = new DocumentRenderer();
  });

  it("should call renderToBuffer and return non-empty buffer for VOUCHER", async () => {
    const buffer = await renderer.render("VOUCHER", {
      code: "VCH-00000001",
      bookingCode: "BKG-00000001",
      travelers: [],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("should call renderToBuffer for PARTIAL_PAYMENT", async () => {
    const buffer = await renderer.render("PARTIAL_PAYMENT", {
      code: "PPD-00000001",
      totalAmount: "5000",
      paidAmount: "2500",
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("should call renderToBuffer for REFUND", async () => {
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
