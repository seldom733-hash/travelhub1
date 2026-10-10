/**
 * STRICT REVIEW 2.5 (§13/§14) — ID стратегия canonical Order:
 *  - nextCode: {prefix}-{N}, N = 8 цифр (атомарный BusinessSequence upsert);
 *  - nextOrderNumber: TH-YYYY-######, последовательность СКВОЗНАЯ ПО ГОДУ
 *    (разные BusinessSequence-ключи TH-2026 / TH-2027 — нет пересечений и
 *    гонок на границе года);
 *  - год по UTC (canonical time-конвенция, НЕ локальный OS-год);
 *  - canonical consumer и test-only fixture делят ОДИН генератор (нет второй
 *    схемы; Step 2.6: HTTP bootstrap-путь удалён).
 *
 * Аудит нумераций (Owner Decision): Hi/Lo-блочная аллокация УДАЛЕНА.
 *  - каждая аллокация = ровно ОДИН upsert `value += 1` → сплошная
 *    последовательность, хвосты блоков не сжигаются;
 *  - перезапуск процесса не влияет на выдачу (нет in-memory кэша/claim-гейтов);
 *  - доменная tx используется, когда передана (аллокация в её рамках);
 *    без tx — autocommit на глобальном клиенте (legacy `null`-вызовы).
 */
import { IdsService } from "./ids.service";

type SeqMock = {
  businessSequence: { upsert: jest.Mock };
};

/** Store-based мок: как PG — один row на prefix, increment атомарен. */
function makeSeq(): SeqMock {
  const store = new Map<string, number>();
  const upsert = jest.fn(
    async (args: {
      where: { prefix: string };
      update?: { value: { increment: number } };
      create?: { prefix: string; value: number };
    }) => {
      const prefix = args.where.prefix;
      const current = store.get(prefix);
      const value = current === undefined ? args.create!.value : current + args.update!.value.increment;
      store.set(prefix, value);
      return { prefix, value };
    },
  );
  return { businessSequence: { upsert } };
}

/** Fallback-путь (без tx): инкремент идёт на глобальном prisma-клиенте. */
const makeIds = (prisma: SeqMock): IdsService => new IdsService(prisma as never);

describe("IdsService — canonical ID policy (STRICT REVIEW 2.5)", () => {
  it("nextCode: ORD-* ровно 8 цифр; каждый вызов = ровно один upsert increment +1 (без блоков)", async () => {
    const prisma = makeSeq();
    const ids = makeIds(prisma);
    expect(await ids.nextCode(null as never, "ORD")).toBe("ORD-00000001");
    expect(await ids.nextCode(null as never, "ORD")).toBe("ORD-00000002");
    expect(prisma.businessSequence.upsert).toHaveBeenCalledTimes(2);
    for (const call of prisma.businessSequence.upsert.mock.calls) {
      expect(call[0].update.value.increment).toBe(1);
      expect(call[0].create.value).toBe(1);
    }
  });

  it("101 аллокация: строго сплошно 1..101, уникальны, ровно 101 upsert (Hi/Lo удалён)", async () => {
    const prisma = makeSeq();
    const ids = makeIds(prisma);
    const codes = await Promise.all(
      Array.from({ length: 101 }, () => ids.nextCode(null as never, "QTE")),
    );
    expect(new Set(codes).size).toBe(101);
    expect(codes[0]).toBe("QTE-00000001");
    expect(codes[100]).toBe("QTE-00000101");
    expect(prisma.businessSequence.upsert).toHaveBeenCalledTimes(101);
    // Ни один инкремент не больше 1 — «блоков» больше нет.
    for (const call of prisma.businessSequence.upsert.mock.calls) {
      expect(call[0].update.value.increment).toBe(1);
    }
  });

  it("перезапуск процесса не сжигает хвост: новая инстанция продолжает с того же store", async () => {
    const prisma = makeSeq();
    const ids1 = makeIds(prisma);
    expect(await ids1.nextCode(null as never, "ORD")).toBe("ORD-00000001");
    expect(await ids1.nextCode(null as never, "ORD")).toBe("ORD-00000002");
    // «Перезапуск»: новая инстанция сервиса над тем же клиентом (in-memory
    // состояния у сервиса нет) — номер продолжается, 3..4, без jump к 101.
    const ids2 = makeIds(prisma);
    expect(await ids2.nextCode(null as never, "ORD")).toBe("ORD-00000003");
    expect(await ids2.nextCode(null as never, "ORD")).toBe("ORD-00000004");
    expect(prisma.businessSequence.upsert).toHaveBeenCalledTimes(4);
  });

  it("переданная доменная tx используется: upsert исполняется на её клиенте", async () => {
    const prisma = makeSeq();
    const txSeq = makeSeq();
    const ids = makeIds(prisma);
    const code = await ids.nextCode(txSeq as never, "ORD");
    expect(code).toBe("ORD-00000001");
    expect(txSeq.businessSequence.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.businessSequence.upsert).not.toHaveBeenCalled();
    // Счётчики независимы: fallback-инстанс продолжает с 1, не с 2.
    expect(await ids.nextCode(null as never, "ORD")).toBe("ORD-00000001");
  });

  it("nextOrderNumber: TH-YYYY-###### — 6 цифр, сквозная по году (разные ключи per year)", async () => {
    const prisma = makeSeq();
    const ids = makeIds(prisma);
    expect(await ids.nextOrderNumber(null as never, 2026)).toBe("TH-2026-000001");
    expect(await ids.nextOrderNumber(null as never, 2026)).toBe("TH-2026-000002");
    // Другой год — ОТДЕЛЬНАЯ последовательность (нет общего счётчика).
    expect(await ids.nextOrderNumber(null as never, 2027)).toBe("TH-2027-000001");
    // Ключи действительно per-year (в BusinessSequence два разных prefix).
    const prefixes = prisma.businessSequence.upsert.mock.calls.map((c) => c[0].where.prefix);
    expect(prefixes).toContain("TH-2026");
    expect(prefixes).toContain("TH-2027");
  });

  it("default год = UTC год (getUTCFullYear, НЕ локальный OS-год)", async () => {
    const prisma = makeSeq();
    const ids = makeIds(prisma);
    await ids.nextOrderNumber(null as never);
    const prefix = prisma.businessSequence.upsert.mock.calls[0][0].where.prefix;
    expect(prefix).toBe(`TH-${new Date().getUTCFullYear()}`);
  });

  it("canonical consumer и test-only fixture делят ОДИН генератор (тот же ключ ORD/TH)", async () => {
    const prisma = makeSeq();
    const ids = makeIds(prisma);
    // Canonical Order (createOrderFromRequested) и test-only fixture
    // (backend/test/fixtures/create-order.fixture.ts, Step 2.6) вызывают те же
    // nextCode(tx,"ORD") / nextOrderNumber(tx) — один атомарный счётчик
    // (на общем prefix-row BusinessSequence), без коллизий.
    const ord1 = await ids.nextCode(null as never, "ORD");
    const th1 = await ids.nextOrderNumber(null as never, 2026);
    const ord2 = await ids.nextCode(null as never, "ORD");
    const th2 = await ids.nextOrderNumber(null as never, 2026);
    expect([ord1, ord2].sort()).toEqual(["ORD-00000001", "ORD-00000002"]);
    expect([th1, th2].sort()).toEqual(["TH-2026-000001", "TH-2026-000002"]);
  });

  it("nextStorefrontCode: публичный SF00N идёт из СВОЕЙ последовательности SFPUB (интерлив с SF- code исключён)", async () => {
    const prisma = makeSeq();
    const ids = makeIds(prisma);
    // Внутренний code (SF-…) и публичный storefrontCode (SF00N) — разные строки.
    expect(await ids.nextCode(null as never, "SF")).toBe("SF-00000001");
    expect(await ids.nextStorefrontCode(null as never)).toBe("SF001");
    expect(await ids.nextCode(null as never, "SF")).toBe("SF-00000002");
    expect(await ids.nextStorefrontCode(null as never)).toBe("SF002");
    const prefixes = prisma.businessSequence.upsert.mock.calls.map((c) => c[0].where.prefix);
    expect(prefixes).toEqual(["SF", "SFPUB", "SF", "SFPUB"]);
  });
});
