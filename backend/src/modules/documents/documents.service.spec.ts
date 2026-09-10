import { Test, type TestingModule } from "@nestjs/testing";
import { DocumentsService } from "./documents.service";
import { DocumentRenderer } from "./document-renderer.service";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { EventBusService } from "../../eventbus/eventbus.service";

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

describe("DocumentRenderer", () => {
  let renderer: DocumentRenderer;

  beforeEach(() => {
    renderer = new DocumentRenderer();
  });

  it("should render VOUCHER type with traveler data", async () => {
    const buffer = await renderer.render("VOUCHER", {
      code: "VCH-00000001",
      bookingCode: "BKG-00000001",
      travelers: [{ firstName: "John", lastName: "Doe" }],
    });
    expect(buffer).toBeInstanceOf(Buffer);
    const content = buffer.toString();
    expect(content).toContain("TRAVELHUB VOUCHER");
    expect(content).toContain("John Doe");
    expect(content).toContain("TravelHub platform confirmation");
  });

  it("should render REFUND type", async () => {
    const buffer = await renderer.render("REFUND", {
      code: "RFD-00000001",
      refundAmount: "100.00",
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toContain("TRAVELHUB REFUND DOCUMENT");
  });

  it("should render PARTIAL_PAYMENT type", async () => {
    const buffer = await renderer.render("PARTIAL_PAYMENT", {
      code: "PPD-00000001",
      totalAmount: "500.00",
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toContain("TRAVELHUB PARTIAL PAYMENT DOCUMENT");
  });
});
