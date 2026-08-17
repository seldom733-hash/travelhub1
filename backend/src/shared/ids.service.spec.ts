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

/**
 * Step 2.17B remediation (Workstream B): аллокация BusinessSequence вынесена
 * из доменной транзакции на выделенный клиент prisma.seqClient — короткая
 * ЯВНАЯ транзакция (BEGIN; upsert; COMMIT), row-lock счётчика держится только
 * ~2-20ms, а не до commit домена. Явная tx (а не autocommit) — критично:
 * на квалификационной машине конкурентные autocommit-запросы сериализуются
 * (~13ms FIFO/query при 50-way), явные транзакции идут параллельно (~20ms).
 * Спека мокает seqClient.$transaction (а не tx), как в проде.
 */
type Seq = {
  $transaction: jest.Mock;
  businessSequence: { upsert: jest.Mock };
};

type PrismaMock = { seqClient: Seq };

const makeSeq = (): Seq => {
  const store = new Map<string, number>();
  const upsert = jest.fn(async (args: { where: { prefix: string }; update: { value: { increment: number } }; create: { prefix: string; value: number } }) => {
    const prefix = args.where.prefix;
    // create: блок [1..blockSize]; update: блок [old+1 .. old+blockSize].
    const increment = args.update?.value?.increment ?? args.create.value;
    const next = (store.get(prefix) ?? 0) + increment;
    store.set(prefix, next);
    return { prefix, value: next };
  });
  const seq = { businessSequence: { upsert } } as unknown as Parameters<Parameters<Seq["$transaction"]>[0]>[0];
  const $transaction = jest.fn(async (cb: (tx: typeof seq) => Promise<unknown>) => cb(seq));
  return { $transaction: $transaction as unknown as Seq["$transaction"], businessSequence: { upsert } };
};

/** Step 2.17B Round 3: Hi/Lo блок-аллокация — блок BUSINESS_SEQUENCE_BLOCK_SIZE (default 100). */
const BLOCK = 100;
const makeIds = (prisma: PrismaMock): IdsService => {
  process.env.BUSINESS_SEQUENCE_BLOCK_SIZE = String(BLOCK);
  return new IdsService(prisma as never);
};

const makePrisma = (): PrismaMock => ({ seqClient: makeSeq() });

describe("IdsService — canonical ID policy (STRICT REVIEW 2.5)", () => {
  it("nextCode: ORD-* ровно 8 цифр, левое дополнение нулями (Hi/Lo блок — 1 claim на 100 кодов)", async () => {
    const prisma = makePrisma();
    const ids = makeIds(prisma);
    expect(await ids.nextCode({} as never, "ORD")).toBe("ORD-00000001");
    expect(await ids.nextCode({} as never, "ORD")).toBe("ORD-00000002");
    // Блочная аллокация: оба кода из кэша — счётчик тронут ОДИН раз.
    expect(prisma.seqClient.businessSequence.upsert).toHaveBeenCalledTimes(1);
  });

  it("Hi/Lo: 101 аллокаций = ровно 2 claim-а блока, коды строго последовательны и уникальны", async () => {
    const prisma = makePrisma();
    const ids = makeIds(prisma);
    const codes = await Promise.all(Array.from({ length: BLOCK + 1 }, () => ids.nextCode({} as never, "QTE")));
    expect(new Set(codes).size).toBe(BLOCK + 1);
    expect(codes[0]).toBe("QTE-00000001");
    expect(codes[BLOCK - 1]).toBe(`QTE-${String(BLOCK).padStart(8, "0")}`);
    expect(codes[BLOCK]).toBe(`QTE-${String(BLOCK + 1).padStart(8, "0")}`);
    expect(prisma.seqClient.businessSequence.upsert).toHaveBeenCalledTimes(2);
    // Второй claim инкрементировал счётчик на blockSize от значения первого блока.
    const lastCall = prisma.seqClient.businessSequence.upsert.mock.calls[1][0];
    expect(lastCall.update.value.increment).toBe(BLOCK);
  });

  it("nextOrderNumber: TH-YYYY-###### — 6 цифр, сквозная по году (разные ключи per year)", async () => {
    const prisma = makePrisma();
    const ids = new IdsService(prisma as never);
    expect(await ids.nextOrderNumber({} as never, 2026)).toBe("TH-2026-000001");
    expect(await ids.nextOrderNumber({} as never, 2026)).toBe("TH-2026-000002");
    // Другой год — ОТДЕЛЬНАЯ последовательность (нет общего счётчика).
    expect(await ids.nextOrderNumber({} as never, 2027)).toBe("TH-2027-000001");
    // Ключи действительно per-year (в BusinessSequence два разных prefix).
    const prefixes = prisma.seqClient.businessSequence.upsert.mock.calls.map((c) => c[0].where.prefix);
    expect(prefixes).toContain("TH-2026");
    expect(prefixes).toContain("TH-2027");
  });

  it("default год = UTC год (getUTCFullYear, НЕ локальный OS-год)", async () => {
    const prisma = makePrisma();
    const ids = new IdsService(prisma as never);
    await ids.nextOrderNumber({} as never);
    const prefix = prisma.seqClient.businessSequence.upsert.mock.calls[0][0].where.prefix;
    expect(prefix).toBe(`TH-${new Date().getUTCFullYear()}`);
  });

  it("canonical consumer и test-only fixture делят ОДИН генератор (тот же ключ ORD/TH)", async () => {
    const prisma = makePrisma();
    const ids = new IdsService(prisma as never);
    // Canonical Order (createOrderFromRequested) и test-only fixture
    // (backend/test/fixtures/create-order.fixture.ts, Step 2.6) вызывают те же
    // nextCode(tx,"ORD") / nextOrderNumber(tx) — один атомарный счётчик
    // (на общем prefix-row BusinessSequence), без коллизий.
    const ord1 = await ids.nextCode({} as never, "ORD");
    const th1 = await ids.nextOrderNumber({} as never, 2026);
    const ord2 = await ids.nextCode({} as never, "ORD");
    const th2 = await ids.nextOrderNumber({} as never, 2026);
    expect([ord1, ord2].sort()).toEqual(["ORD-00000001", "ORD-00000002"]);
    expect([th1, th2].sort()).toEqual(["TH-2026-000001", "TH-2026-000002"]);
  });
});
