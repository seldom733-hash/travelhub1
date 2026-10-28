import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { SupplierPaymentEvidenceService } from "./supplier-payment-evidence.service";

const ACTOR = { id: "u-fin", username: "finance" };

function file(over: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}) {
  return {
    originalname: "invoice.pdf",
    mimetype: "application/pdf",
    size: 1024,
    buffer: Buffer.from("%PDF-1.4 test"),
    ...over,
  };
}

function makeService(opts: { status?: string; createFails?: boolean; doc?: Record<string, unknown> | null; count?: number } = {}) {
  const evidence = {
    count: jest.fn().mockResolvedValue(opts.count ?? 0),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(opts.doc ?? null),
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: `doc-${Math.random().toString(36).slice(2, 8)}`,
      fileName: data.fileName,
      mimeType: data.mimeType,
      size: data.size,
      createdAt: new Date("2026-10-25T12:00:00Z"),
    })),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma: any = {
    supplierPayout: {
      findFirst: jest.fn().mockResolvedValue({ id: "pay-1", code: "SPO-00000001", status: opts.status ?? "PENDING" }),
    },
    supplierPaymentEvidence: evidence,
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };
  if (opts.createFails) evidence.create.mockRejectedValue(new Error("db down"));
  const storage = {
    putObject: jest.fn().mockResolvedValue({ key: "k", size: 10 }),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    objectExists: jest.fn(),
    getSignedReadUrl: jest.fn().mockResolvedValue("https://signed.example/doc"),
  };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  const service = new SupplierPaymentEvidenceService(prisma, security as never, storage as never);
  return { service, prisma, storage, security, evidence };
}

describe("SupplierPaymentEvidenceService — документы платежа", () => {
  it("upload PDF: storage → metadata+audit в транзакции (ключ наружу не отдаётся)", async () => {
    const { service, storage, security } = makeService();
    const result = await service.upload("SPO-00000001", [file()], ACTOR);
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty("storageKey");
    expect(security.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "finance.supplier_payment.document_uploaded" }),
    );
  });

  it("upload: недопустимый MIME → 422, storage не вызывается", async () => {
    const { service, storage } = makeService();
    await expect(service.upload("SPO-1", [file({ mimetype: "text/html" })], ACTOR)).rejects.toBeInstanceOf(
      ValidationDomainError,
    );
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("upload: HTML под видом PDF → 422 (signature mismatch)", async () => {
    const { service, storage } = makeService();
    await expect(
      service.upload("SPO-1", [file({ buffer: Buffer.from("<html>not a pdf</html>") })], ACTOR),
    ).rejects.toBeInstanceOf(ValidationDomainError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("upload: размер > 10 MB → 422", async () => {
    const { service } = makeService();
    await expect(service.upload("SPO-1", [file({ size: 11 * 1024 * 1024 })], ACTOR)).rejects.toBeInstanceOf(
      ValidationDomainError,
    );
  });

  it("upload: ошибка БД → компенсирующее удаление объектов S3", async () => {
    const { service, storage } = makeService({ createFails: true });
    await expect(service.upload("SPO-1", [file()], ACTOR)).rejects.toBeInstanceOf(ValidationDomainError);
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it("upload: CANCELLED-платёж закрыт для новых документов", async () => {
    const { service } = makeService({ status: "CANCELLED" });
    await expect(service.upload("SPO-1", [file()], ACTOR)).rejects.toBeInstanceOf(ConflictError);
  });

  it("download: signed URL по документу своего платежа", async () => {
    const { service, storage } = makeService({
      doc: { storageKey: "finance/pay-1/a.pdf", fileName: "a.pdf", mimeType: "application/pdf" },
    });
    const result = await service.download("SPO-1", "doc-1");
    expect(result.url).toBe("https://signed.example/doc");
    expect(storage.getSignedReadUrl).toHaveBeenCalledWith("finance/pay-1/a.pdf", 300);
  });

  it("download: документ другого платежа → 404 (IDOR)", async () => {
    const { service } = makeService({ doc: null });
    await expect(service.download("SPO-OTHER", "doc-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("delete: CONFIRMED-платёж → 409 (исполненные документы неизменяемы)", async () => {
    const { service, evidence } = makeService({ status: "CONFIRMED", doc: { id: "doc-1", storageKey: "k", fileName: "a.pdf" } });
    await expect(service.remove("SPO-1", "doc-1", ACTOR)).rejects.toBeInstanceOf(ConflictError);
    expect(evidence.update).not.toHaveBeenCalled();
  });

  it("delete: PENDING → soft delete + удаление объекта + audit", async () => {
    const { service, evidence, storage, security } = makeService({
      status: "PENDING",
      doc: { id: "doc-1", storageKey: "finance/pay-1/a.pdf", fileName: "a.pdf" },
    });
    await service.remove("SPO-1", "doc-1", ACTOR);
    expect(evidence.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedById: ACTOR.id }) }),
    );
    expect(storage.deleteObject).toHaveBeenCalledWith("finance/pay-1/a.pdf");
    expect(security.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "finance.supplier_payment.document_deleted" }),
    );
  });
});
