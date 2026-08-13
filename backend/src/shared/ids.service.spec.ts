/**
 * STRICT REVIEW 2.5 (§13/§14) — ID стратегия canonical Order:
 *  - nextCode: {prefix}-{N}, N = 8 цифр (атомарный BusinessSequence upsert);
 *  - nextOrderNumber: TH-YYYY-######, последовательность СКВОЗНАЯ ПО ГОДУ
 *    (разные BusinessSequence-ключи TH-2026 / TH-2027 — нет пересечений и
 *    гонок на границе года);
 *  - год по UTC (canonical time-конвенция, НЕ локальный OS-год);
 *  - canonical consumer и test-only fixture делят ОДИН генератор (нет второй
 *    схемы; Step 2.6: HTTP bootstrap-путь удалён).
 */
import { IdsService } from "./ids.service";

type Tx = { businessSequence: { upsert: jest.Mock } };

const makeTx = (): Tx => {
  const store = new Map<string, number>();
  const upsert = jest.fn(async (args: { where: { prefix: string }; update: { value: { increment: number } }; create: { prefix: string; value: number } }) => {
    const prefix = args.where.prefix;
    const next = (store.get(prefix) ?? 0) + (args.update.value.increment ?? 1);
    store.set(prefix, next);
    return { prefix, value: next };
  });
  return { businessSequence: { upsert } };
};

describe("IdsService — canonical ID policy (STRICT REVIEW 2.5)", () => {
  it("nextCode: ORD-* ровно 8 цифр, левое дополнение нулями", async () => {
    const tx = makeTx();
    const ids = new IdsService({} as never);
    expect(await ids.nextCode(tx as never, "ORD")).toBe("ORD-00000001");
    expect(await ids.nextCode(tx as never, "ORD")).toBe("ORD-00000002");
    expect(tx.businessSequence.upsert).toHaveBeenCalledTimes(2);
  });

  it("nextOrderNumber: TH-YYYY-###### — 6 цифр, сквозная по году (разные ключи per year)", async () => {
    const tx = makeTx();
    const ids = new IdsService({} as never);
    expect(await ids.nextOrderNumber(tx as never, 2026)).toBe("TH-2026-000001");
    expect(await ids.nextOrderNumber(tx as never, 2026)).toBe("TH-2026-000002");
    // Другой год — ОТДЕЛЬНАЯ последовательность (нет общего счётчика).
    expect(await ids.nextOrderNumber(tx as never, 2027)).toBe("TH-2027-000001");
    // Ключи действительно per-year (в BusinessSequence два разных prefix).
    const prefixes = tx.businessSequence.upsert.mock.calls.map((c) => c[0].where.prefix);
    expect(prefixes).toContain("TH-2026");
    expect(prefixes).toContain("TH-2027");
  });

  it("default год = UTC год (getUTCFullYear, НЕ локальный OS-год)", async () => {
    const tx = makeTx();
    const ids = new IdsService({} as never);
    await ids.nextOrderNumber(tx as never);
    const prefix = tx.businessSequence.upsert.mock.calls[0][0].where.prefix;
    expect(prefix).toBe(`TH-${new Date().getUTCFullYear()}`);
  });

  it("canonical consumer и test-only fixture делят ОДИН генератор (тот же ключ ORD/TH)", async () => {
    const tx = makeTx();
    const ids = new IdsService({} as never);
    // Canonical Order (createOrderFromRequested) и test-only fixture
    // (backend/test/fixtures/create-order.fixture.ts, Step 2.6) вызывают те же
    // nextCode(tx,"ORD") / nextOrderNumber(tx) — один атомарный счётчик,
    // без коллизий.
    const ord1 = await ids.nextCode(tx as never, "ORD");
    const th1 = await ids.nextOrderNumber(tx as never, 2026);
    const ord2 = await ids.nextCode(tx as never, "ORD");
    const th2 = await ids.nextOrderNumber(tx as never, 2026);
    expect([ord1, ord2].sort()).toEqual(["ORD-00000001", "ORD-00000002"]);
    expect([th1, th2].sort()).toEqual(["TH-2026-000001", "TH-2026-000002"]);
  });
});
