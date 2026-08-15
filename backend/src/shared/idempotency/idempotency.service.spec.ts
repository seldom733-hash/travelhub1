/**
 * PHASE 2 STEP 2.12H — IdempotencyService unit tests.
 *
 * Claim → execute → complete, DB unique backstop (P2002), replay, divergent
 * reuse → 409, stale IN_PROGRESS takeover (CAS), business-error → claim удалён
 * (ключ не poisoning). Тайминговые in-progress paths (bounded wait) покрыты
 * e2e T7/T8 (genuine DB concurrency), здесь — детерминированные сценарии.
 */
import { Prisma } from "../../generated/prisma/client";
import { ExternalIdempotencyStatus } from "../../generated/prisma/enums";
import type { PrismaService } from "../../prisma/prisma.service";
import { ConflictError } from "../errors";
import { IdempotencyService } from "./idempotency.service";

interface PrismaStub {
  externalIdempotencyRecord: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
}

const P2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
  code: "P2002",
  clientVersion: "5",
});

const SCOPE = { type: "USER", id: "user-1" };
const OPTS = {
  scope: SCOPE,
  operation: "payment.create",
  clientKey: "k-1",
  fingerprint: "fp-1",
};

const COMPLETED_RECORD = {
  id: "rec-1",
  slotKey: "slot-1",
  scopeType: "USER",
  scopeId: "user-1",
  operation: "payment.create",
  fingerprint: "fp-1",
  status: ExternalIdempotencyStatus.COMPLETED,
  claimedAt: new Date("2026-08-15T00:00:00Z"),
  responseStatus: 201,
  responseBody: { id: "pay-1" },
  completedAt: new Date("2026-08-15T00:00:01Z"),
  createdAt: new Date("2026-08-15T00:00:00Z"),
  updatedAt: new Date("2026-08-15T00:00:01Z"),
};

describe("2.12H IdempotencyService", () => {
  let prisma: PrismaStub;
  let service: IdempotencyService;

  beforeEach(() => {
    prisma = {
      externalIdempotencyRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  it("1. first execution: claim → execute один раз → COMPLETED c результатом", async () => {
    prisma.externalIdempotencyRecord.create.mockResolvedValue({ id: "rec" });
    prisma.externalIdempotencyRecord.update.mockResolvedValue({ id: "rec" });
    const execute = jest.fn().mockResolvedValue({ status: 201, body: { id: "pay-1" } });

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(prisma.externalIdempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ExternalIdempotencyStatus.COMPLETED,
          responseStatus: 201,
          responseBody: { id: "pay-1" },
        }),
      }),
    );
    expect(result).toEqual({ replay: false, status: 201, body: { id: "pay-1" } });
  });

  it("2. identical retry: COMPLETED + same fingerprint → replay без повторного execute", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue(COMPLETED_RECORD);
    const execute = jest.fn().mockResolvedValue({ status: 201, body: { id: "pay-1" } });

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({ replay: true, status: 201, body: { id: "pay-1" } });
  });

  it("3. divergent reuse: COMPLETED + другой fingerprint → controlled 409, execute не вызывается", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue({ ...COMPLETED_RECORD, fingerprint: "fp-other" });
    const execute = jest.fn();

    await expect(service.execute({ ...OPTS, fingerprint: "fp-new", execute })).rejects.toBeInstanceOf(ConflictError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("4. divergent on IN_PROGRESS → immediate 409 (без ожидания)", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue({
      ...COMPLETED_RECORD,
      status: ExternalIdempotencyStatus.IN_PROGRESS,
      fingerprint: "fp-other",
    });
    const execute = jest.fn();

    await expect(service.execute({ ...OPTS, fingerprint: "fp-new", execute })).rejects.toBeInstanceOf(ConflictError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("5. stale IN_PROGRESS: CAS takeover успешен → повторное выполнение (business-idempotent)", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue({
      ...COMPLETED_RECORD,
      status: ExternalIdempotencyStatus.IN_PROGRESS,
      claimedAt: new Date(Date.now() - 120_000), // stale
    });
    prisma.externalIdempotencyRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma.externalIdempotencyRecord.update.mockResolvedValue({ id: "rec" });
    const execute = jest.fn().mockResolvedValue({ status: 201, body: { id: "pay-1" } });

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ replay: false, status: 201, body: { id: "pay-1" } });
  });

  it("6. stale IN_PROGRESS: takeover проигран, слот COMPLETED другим процессом → replay", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique
      .mockResolvedValueOnce({
        ...COMPLETED_RECORD,
        status: ExternalIdempotencyStatus.IN_PROGRESS,
        claimedAt: new Date(Date.now() - 120_000),
      })
      .mockResolvedValueOnce(COMPLETED_RECORD);
    prisma.externalIdempotencyRecord.updateMany.mockResolvedValue({ count: 0 });
    const execute = jest.fn();

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({ replay: true, status: 201, body: { id: "pay-1" } });
  });

  it("7. business error → claim удаляется, ошибка пробрасывается (ключ переиспользуем)", async () => {
    prisma.externalIdempotencyRecord.create.mockResolvedValue({ id: "rec" });
    prisma.externalIdempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
    const boom = new ConflictError("order not payable");
    const execute = jest.fn().mockRejectedValue(boom);

    await expect(service.execute({ ...OPTS, execute })).rejects.toBe(boom);
    expect(prisma.externalIdempotencyRecord.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: ExternalIdempotencyStatus.IN_PROGRESS }) }),
    );
    expect(prisma.externalIdempotencyRecord.update).not.toHaveBeenCalled();
  });

  it("8. P2002 race: create упал, слот исчез между P2002 и чтением → повторная попытка", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValueOnce(P2002).mockResolvedValueOnce({ id: "rec" });
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue(null);
    prisma.externalIdempotencyRecord.update.mockResolvedValue({ id: "rec" });
    const execute = jest.fn().mockResolvedValue({ status: 201, body: { id: "pay-1" } });

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.replay).toBe(false);
  });

  it("9. COMPLETED с null responseStatus → controlled conflict (не raw 500)", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue({ ...COMPLETED_RECORD, responseStatus: null });
    const execute = jest.fn();

    await expect(service.execute({ ...OPTS, execute })).rejects.toBeInstanceOf(ConflictError);
  });

  it("10. STRICT REVIEW: P2025 на complete (слот удалён конкурентным rollback-ом после бизнес-commit) → возвращаем закоммиченный результат, НЕ raw 500", async () => {
    prisma.externalIdempotencyRecord.create.mockResolvedValue({ id: "rec" });
    const P2025 = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "5",
    });
    prisma.externalIdempotencyRecord.update.mockRejectedValue(P2025);
    const execute = jest.fn().mockResolvedValue({ status: 201, body: { id: "pay-1" } });

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ replay: false, status: 201, body: { id: "pay-1" } });
    // Слот удалён — deleteMany не вызывается (нечего чистить, не poison).
    expect(prisma.externalIdempotencyRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("11. STRICT REVIEW: non-P2002 ошибка на claim (create) → пробрасывается, НЕ трактуется как replay", async () => {
    const boom = new Error("connection refused");
    prisma.externalIdempotencyRecord.create.mockRejectedValue(boom);
    const execute = jest.fn();

    await expect(service.execute({ ...OPTS, execute })).rejects.toBe(boom);
    expect(execute).not.toHaveBeenCalled();
  });

  it("12. STRICT REVIEW: неизвестная внутренняя ошибка (не P2025) на complete → не превращается в false completed, пробрасывается", async () => {
    prisma.externalIdempotencyRecord.create.mockResolvedValue({ id: "rec" });
    prisma.externalIdempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
    const boom = new Error("unexpected internal error");
    prisma.externalIdempotencyRecord.update.mockRejectedValue(boom);
    const execute = jest.fn().mockResolvedValue({ status: 201, body: { id: "pay-1" } });

    await expect(service.execute({ ...OPTS, execute })).rejects.toBe(boom);
    expect(prisma.externalIdempotencyRecord.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: ExternalIdempotencyStatus.IN_PROGRESS }) }),
    );
  });

  it("13. STRICT REVIEW: generic unknown business error → claim удалён, ошибка пробрасывается (не false COMPLETED)", async () => {
    prisma.externalIdempotencyRecord.create.mockResolvedValue({ id: "rec" });
    prisma.externalIdempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
    const boom = new Error("some internal failure");
    const execute = jest.fn().mockRejectedValue(boom);

    await expect(service.execute({ ...OPTS, execute })).rejects.toBe(boom);
    expect(prisma.externalIdempotencyRecord.update).not.toHaveBeenCalled();
    expect(prisma.externalIdempotencyRecord.deleteMany).toHaveBeenCalled();
  });

  it("14. STRICT REVIEW: COMPLETED с СТАРЫМ claimedAt НЕ перехватывается stale-takeover-ом (completed unreclaimable)", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    // claimedAt — 2 часа назад (stale по времени), но статус COMPLETED.
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue({
      ...COMPLETED_RECORD,
      claimedAt: new Date(Date.now() - 7_200_000),
    });
    const execute = jest.fn();

    const result = await service.execute({ ...OPTS, execute });

    expect(execute).not.toHaveBeenCalled();
    expect(prisma.externalIdempotencyRecord.updateMany).not.toHaveBeenCalled(); // никакого takeover
    expect(result.replay).toBe(true);
  });

  it("15. STRICT REVIEW: fresh (non-stale) IN_PROGRESS НЕ перехватывается takeover-ом (active record не украдён)", async () => {
    prisma.externalIdempotencyRecord.create.mockRejectedValue(P2002);
    prisma.externalIdempotencyRecord.findUnique.mockResolvedValue({
      ...COMPLETED_RECORD,
      status: ExternalIdempotencyStatus.IN_PROGRESS,
      claimedAt: new Date(), // fresh — active non-stale
    });
    const execute = jest.fn();

    const promise = service.execute({ ...OPTS, execute });
    // Bounded wait (2s) → 409; takeover НЕ вызывается.
    await expect(promise).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.externalIdempotencyRecord.updateMany).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
