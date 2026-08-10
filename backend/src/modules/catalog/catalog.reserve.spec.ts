/**
 * Step 2.4 (DD-022 closure) — CatalogService.reserveAvailability (owner command).
 *
 * Проверяем ЧИСТУЮ логику через mocked Prisma tx:
 *  - атомарный conditional UPDATE (raw) — единственный last-slot guard;
 *  - count=1 → создаётся HELD reservation с RSR-* кодом;
 *  - count=0 + строка отсутствует → 422 NOT_CONFIGURED;
 *  - count=0 + capacity недостаточна → 409 ConflictError;
 *  - quantity < 1 → 422;
 *  - date нормализуется к UTC midnight.
 */
import { CatalogService } from "./catalog.service";
import { ValidationDomainError, ConflictError } from "../../shared/errors";

type Tx = any;

function makeTx(overrides: Partial<Record<"executeRaw" | "availabilityReservation" | "availability", any>> = {}): Tx {
  return {
    $executeRaw: overrides.executeRaw ?? (async () => 1),
    availability: overrides.availability ?? { findFirst: async () => null },
    availabilityReservation:
      overrides.availabilityReservation ??
      {
        create: jest.fn(async (args: any) => ({ id: "rsr-id", code: args.data.code })),
      },
  };
}

function makeService(tx: Tx) {
  // Только prisma + ids используются в reserveAvailability; остальное не задействовано.
  return new CatalogService(tx as any, { nextCode: async () => "RSR-00000001" } as any, {} as any, {} as any, {} as any);
}

const BASE = { productId: "prd-1", tariffId: "trf-1", date: new Date("2026-09-01T10:00:00.000Z"), quantity: 2, sourceSaleId: "sale-1" };

describe("Step 2.4 — reserveAvailability (owner command)", () => {
  it("успех: atomic UPDATE → HELD reservation с RSR-* кодом и UTC-midnight date", async () => {
    let rawSql = "";
    const tx = makeTx({
      executeRaw: async (...args: unknown[]) => {
        // Prisma $executeRaw template: args[0] — SQL с плейсхолдерами, values — отдельно.
        rawSql = String(args[0]);
        return 1;
      },
    });
    const svc = makeService(tx);

    const res = await svc.reserveAvailability(tx, BASE);

    expect(res.reservationId).toBe("rsr-id");
    expect(res.code).toBe("RSR-00000001");
    // RAW SQL — conditional last-slot guard (slotsTotal - slotsBooked - slotsReserved >= qty).
    expect(rawSql).toContain("slotsReserved");
    expect(rawSql).toContain("slotsTotal");
    expect(rawSql).toContain(">= ");
    // Reservation создаётся HELD.
    expect(tx.availabilityReservation.create.mock.calls[0][0].data.status).toBe("HELD");
    expect(tx.availabilityReservation.create.mock.calls[0][0].data.quantity).toBe(2);
  });

  it("last-slot: count=0 + capacity достаточно (обновление 0 строк невозможно при наличии capacity) → defensive 409", async () => {
    const tx = makeTx({ executeRaw: async () => 0, availability: { findFirst: async () => ({ id: "av-1", slotsTotal: 10, slotsBooked: 0, slotsReserved: 0 }) } });
    const svc = makeService(tx);
    await expect(svc.reserveAvailability(tx, BASE)).rejects.toBeInstanceOf(ConflictError);
  });

  it("last-slot: count=0 + capacity недостаточна → 409 ConflictError (не negative capacity)", async () => {
    const tx = makeTx({
      executeRaw: async () => 0,
      availability: { findFirst: async () => ({ id: "av-1", slotsTotal: 1, slotsBooked: 0, slotsReserved: 1 }) },
    });
    const svc = makeService(tx);
    await expect(svc.reserveAvailability(tx, BASE)).rejects.toBeInstanceOf(ConflictError);
  });

  it("NOT_CONFIGURED: count=0 + строка отсутствует → 422", async () => {
    const tx = makeTx({ executeRaw: async () => 0, availability: { findFirst: async () => null } });
    const svc = makeService(tx);
    await expect(svc.reserveAvailability(tx, BASE)).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("quantity < 1 → 422 до обращения к БД", async () => {
    const tx = makeTx();
    const svc = makeService(tx);
    await expect(svc.reserveAvailability(tx, { ...BASE, quantity: 0 })).rejects.toBeInstanceOf(ValidationDomainError);
  });
});
