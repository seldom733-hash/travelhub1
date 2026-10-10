/**
 * M4.2 — общий Customer Resolver (ADR-0016 §5).
 * MOCK-based unit tests: 0/1/>1, legacy-fallback, normalization variants,
 * email-reuse/phone-reuse, userId account-link, no auto-merge by construction.
 */

import {
  findCustomerIdsByCanonicalPhone,
  resolveCustomerByPhone,
  resolveCustomer,
} from "./customer-resolver";

interface FakeCustomer {
  id: string;
  email?: string | null;
  phone?: string | null;
  phoneCanonical?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** Where-aware mock: поддерживает ровно два shape'а запроса resolver'а. */
function makeDb(customers: FakeCustomer[], users: Array<{ id: string; customerId: string | null }> = []) {
  const findMany = jest.fn(async (args: { where?: Record<string, any> } = {}) => {
    const where = args.where ?? {};
    return customers
      .filter((c) => {
        if (where.phoneCanonical !== undefined) {
          if (where.phoneCanonical === null) {
            if ((c.phoneCanonical ?? null) !== null) return false;
            if (where.phone?.not === null && (c.phone ?? null) === null) return false;
            return true;
          }
          return c.phoneCanonical === where.phoneCanonical;
        }
        return true;
      })
      .map((c) => ({ id: c.id, phone: c.phone ?? null, phoneCanonical: c.phoneCanonical ?? null }));
  });
  const customer = {
    findMany,
    findUnique: jest.fn(async (args: { where: { id?: string; email?: string } }) => {
      if (args.where.email !== undefined) {
        const c = customers.find((x) => (x.email ?? null) === args.where.email);
        return c ? { id: c.id } : null;
      }
      const c = customers.find((x) => x.id === args.where.id);
      return c ? { id: c.id } : null;
    }),
    create: jest.fn(),
    update: jest.fn(),
  };
  const user = {
    findUnique: jest.fn(async (args: { where: { id: string } }) => {
      const u = users.find((x) => x.id === args.where.id);
      return u ? { customerId: u.customerId } : null;
    }),
  };
  return { db: { customer, user } as never, customer, user, findMany };
}

describe("M4.2 — findCustomerIdsByCanonicalPhone (indexed + legacy fallback)", () => {
  it("0 совпадений → []", async () => {
    const { db } = makeDb([{ id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" }]);
    await expect(findCustomerIdsByCanonicalPhone(db, "+994502222222")).resolves.toEqual([]);
  });

  it("1 совпадение → один id", async () => {
    const { db } = makeDb([
      { id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" },
      { id: "c2", phone: "+994502222222", phoneCanonical: "+994502222222" },
    ]);
    await expect(findCustomerIdsByCanonicalPhone(db, "+994501111111")).resolves.toEqual(["c1"]);
  });

  it(">1 совпадений → все кандидаты (без merge)", async () => {
    const { db } = makeDb([
      { id: "c1", phone: "0507000000", phoneCanonical: "+994507000000" },
      { id: "c2", phone: "+994507000000", phoneCanonical: "+994507000000" },
    ]);
    const ids = await findCustomerIdsByCanonicalPhone(db, "+994507000000");
    expect(ids.sort()).toEqual(["c1", "c2"]);
  });

  it("legacy-fallback: строка без phoneCanonical матчится по raw phone (локальный формат)", async () => {
    const { db, findMany } = makeDb([
      { id: "legacy-1", phone: "050 111 22 33", phoneCanonical: null },
      { id: "other", phone: "+994503333333", phoneCanonical: "+994503333333" },
    ]);
    await expect(findCustomerIdsByCanonicalPhone(db, "+994501112233")).resolves.toEqual(["legacy-1"]);
    // Порядок: indexed-запрос первый, legacy-fallback второй (документировано).
    expect(findMany.mock.calls[0]![0]!.where).toEqual({ phoneCanonical: "+994501112233" });
    expect(findMany.mock.calls[1]![0]!.where).toEqual({ phoneCanonical: null, phone: { not: null } });
  });

  it("union без дублей: id из indexed и fallback встречается один раз", async () => {
    // Симуляция: оба запроса вернули одну и ту же строку → Set дедуплицирует.
    const { db, findMany } = makeDb([{ id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" }]);
    findMany.mockImplementation(async () => [{ id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" }]);
    await expect(findCustomerIdsByCanonicalPhone(db, "+994501111111")).resolves.toEqual(["c1"]);
  });
});

describe("M4.2 — resolveCustomerByPhone (0/1/>1)", () => {
  it("невалидный телефон → UNMATCHED без кандидатов, canonical=null (не угадывать)", async () => {
    const { db } = makeDb([]);
    const r = await resolveCustomerByPhone(db, "not-a-phone");
    expect(r).toEqual({ status: "UNMATCHED", customerId: null, candidates: [], canonicalPhone: null, source: "phone" });
  });

  it("локальный AZ-формат нормализуется перед поиском", async () => {
    const { db } = makeDb([{ id: "c1", phone: "+994501112233", phoneCanonical: "+994501112233" }]);
    const r = await resolveCustomerByPhone(db, "0501112233");
    expect(r).toMatchObject({ status: "MATCHED", customerId: "c1", canonicalPhone: "+994501112233" });
  });

  it("0 → UNMATCHED, 1 → MATCHED, >1 → AMBIGUOUS (candidates без customerId)", async () => {
    const zero = await resolveCustomerByPhone(makeDb([]).db, "+994501111111");
    expect(zero.status).toBe("UNMATCHED");

    const one = await resolveCustomerByPhone(
      makeDb([{ id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" }]).db,
      "+994501111111",
    );
    expect(one).toMatchObject({ status: "MATCHED", customerId: "c1" });

    const many = await resolveCustomerByPhone(
      makeDb([
        { id: "c1", phone: "0507000000", phoneCanonical: "+994507000000" },
        { id: "c2", phone: "+994507000000", phoneCanonical: "+994507000000" },
      ]).db,
      "+994507000000",
    );
    expect(many.status).toBe("AMBIGUOUS");
    expect(many.customerId).toBeNull();
    expect(many.candidates.sort()).toEqual(["c1", "c2"]);
  });
});

describe("M4.2 — resolveCustomer (channel-independent вход)", () => {
  it("userId с customerId → MATCHED (явный account-link)", async () => {
    const { db, customer } = makeDb(
      [{ id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" }],
      [{ id: "u1", customerId: "c1" }],
    );
    const r = await resolveCustomer(db, { userId: "u1", phone: "+994501111111", email: "x@y.az" });
    expect(r).toMatchObject({ status: "MATCHED", customerId: "c1", source: "user" });
    expect(customer.findUnique).not.toHaveBeenCalled();
  });

  it("phone-reuse: телефон матчится → MATCHED, email другого клиента игнорируется", async () => {
    const { db, customer } = makeDb([
      { id: "c-phone", phone: "+994501111111", phoneCanonical: "+994501111111" },
      { id: "c-email", email: "other@x.az" },
    ]);
    const r = await resolveCustomer(db, { phone: "0501111111", email: "other@x.az" });
    expect(r).toMatchObject({ status: "MATCHED", customerId: "c-phone", source: "phone" });
    expect(customer.findUnique).not.toHaveBeenCalled(); // email-путь не перебивает телефон
  });

  it("email-reuse: телефон не задан/не сматчился → MATCHED по email (read-only reuse)", async () => {
    const { db } = makeDb([{ id: "c1", email: "buyer@x.az" }]);
    const byEmail = await resolveCustomer(db, { email: "Buyer@X.az" });
    expect(byEmail).toMatchObject({ status: "MATCHED", customerId: "c1", source: "email" });

    const noPhoneMatch = await resolveCustomer(db, { phone: "+994509999999", email: "buyer@x.az" });
    expect(noPhoneMatch).toMatchObject({ status: "MATCHED", customerId: "c1", source: "email" });
  });

  it("phone AMBIGUOUS → возвращается как есть, email не «спасает» (никакого автовыбора)", async () => {
    const { db, customer } = makeDb([
      { id: "c1", phone: "+994507000000", phoneCanonical: "+994507000000", email: "a@x.az" },
      { id: "c2", phone: "0507000000", phoneCanonical: "+994507000000", email: "b@x.az" },
    ]);
    const r = await resolveCustomer(db, { phone: "0507000000", email: "a@x.az" });
    expect(r.status).toBe("AMBIGUOUS");
    expect(r.customerId).toBeNull();
    expect(r.candidates.sort()).toEqual(["c1", "c2"]);
    expect(customer.findUnique).not.toHaveBeenCalled();
  });

  it("пустой вход → UNMATCHED", async () => {
    const { db } = makeDb([{ id: "c1", email: "someone@x.az" }]);
    await expect(resolveCustomer(db, {})).resolves.toMatchObject({ status: "UNMATCHED", customerId: null });
  });
});

describe("M4.2 — no auto-merge by construction", () => {
  it("одинаковое ФИО + разные телефоны → разные идентичности, никакого merge", async () => {
    const { db } = makeDb([
      { id: "c1", email: "ivan1@x.az", phone: "+994501111111", phoneCanonical: "+994501111111", firstName: "Иван", lastName: "Петров" },
      { id: "c2", email: "ivan2@x.az", phone: "+994502222222", phoneCanonical: "+994502222222", firstName: "Иван", lastName: "Петров" },
    ]);
    const byPhone1 = await resolveCustomer(db, { phone: "+994501111111" });
    const byPhone2 = await resolveCustomer(db, { phone: "+994502222222" });
    expect(byPhone1.customerId).toBe("c1");
    expect(byPhone2.customerId).toBe("c2");
    expect(byPhone1.candidates).toEqual(["c1"]);
    expect(byPhone2.candidates).toEqual(["c2"]);
  });

  it("конкурентный резолв двух идентичных запросов → одинаковый детерминированный результат (read-only)", async () => {
    const { db, customer } = makeDb([{ id: "c1", phone: "+994501111111", phoneCanonical: "+994501111111" }]);
    const [a, b] = await Promise.all([
      resolveCustomerByPhone(db, "0501111111"),
      resolveCustomerByPhone(db, "+994501111111"),
    ]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: "MATCHED", customerId: "c1" });
    expect(customer.create).not.toHaveBeenCalled();
    expect(customer.update).not.toHaveBeenCalled();
  });
});
