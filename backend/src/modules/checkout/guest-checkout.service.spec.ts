import { GuestCheckoutService } from "./guest-checkout.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";

/**
 * M4.5 §23 — guest checkout unit: onboarding → Customer Resolver →
 * Customer (create/reuse) → Request.
 *
 * Покрытие: нормализация телефона (default region + country), UNMATCHED →
 * create, MATCHED → reuse, email-fallback reuse, AMBIGUOUS → 409 (никогда не
 * auto-merge), невалидный product → 404 без orphan-customer, дефолты Request
 * (quantity/travelerCount), system-актор guest, audit без PII.
 */

interface FakeCustomer {
  id: string;
  email: string;
  phoneCanonical: string | null;
}

function makeService(customers: FakeCustomer[], opts: { knownProducts?: string[] } = {}) {
  const knownProducts = opts.knownProducts ?? [];
  const prisma = {
    customer: {
      // findCustomerIdsByCanonicalPhone: запрос №1 — indexed по phoneCanonical,
      // запрос №2 — legacy-fallback (phoneCanonical IS NULL AND phone NOT NULL).
      findMany: jest.fn(async (args: Record<string, any>) => {
        const where = args?.where ?? {};
        if ("phone" in where) {
          return customers.filter((c) => c.phoneCanonical === null).map((c) => ({ id: c.id }));
        }
        if (where.phoneCanonical === null) {
          return customers.filter((c) => c.phoneCanonical === null).map((c) => ({ id: c.id }));
        }
        return customers.filter((c) => c.phoneCanonical === where.phoneCanonical).map((c) => ({ id: c.id }));
      }),
      findUnique: jest.fn(async (args: { where: Record<string, string> }) => {
        if (args.where.email !== undefined) {
          const c = customers.find((x) => x.email === args.where.email);
          return c ? { id: c.id } : null;
        }
        return null;
      }),
    },
    user: {
      findUnique: jest.fn(async () => null),
    },
    product: {
      findUnique: jest.fn(async (args: { where: { id: string } }) =>
        knownProducts.includes(args.where.id) ? { id: args.where.id } : null,
      ),
    },
  };
  const crm = {
    createCustomer: jest.fn(async (input: Record<string, unknown>, actor?: string) => {
      const id = `cu-created-${(customers.length as number) + 1}`;
      customers.push({
        id,
        email: String(input.email),
        phoneCanonical: String(input.phone ?? ""),
      });
      return { customer: { id } };
    }),
  };
  const requests = {
    createRequest: jest.fn(async (dto: Record<string, unknown>, actor: { id: string | null; username: string }) => ({
      id: "req-1",
      referenceNumber: "REQ-GUEST-1",
      ...dto,
      __actor: actor,
    })),
  };
  const security = { audit: jest.fn(async () => undefined) };
  const service = new GuestCheckoutService(prisma as never, security as never, crm as never, requests as never);
  return { service, prisma, crm, requests, security, customers };
}

describe("GuestCheckoutService.checkout (§23)", () => {
  it("невалидный телефон → ValidationDomainError; без create/request/audit", async () => {
    const { service, crm, requests } = makeService([]);
    await expect(service.checkout({ email: "a@b.test", phone: "abc" })).rejects.toBeInstanceOf(ValidationDomainError);
    expect(crm.createCustomer).not.toHaveBeenCalled();
    expect(requests.createRequest).not.toHaveBeenCalled();
  });

  it("UNMATCHED → create Customer (default region AZ, E.164) → Request с customerId; created=true", async () => {
    const { service, crm, requests, security } = makeService([]);
    const res = await service.checkout({
      email: " Guest@Example.TEST ",
      phone: "050 123 45 67",
      firstName: "Guest",
      lastName: "One",
    });

    expect(res.customer.created).toBe(true);
    expect(res.resolvedSource).toBe("none");
    expect(crm.createCustomer).toHaveBeenCalledTimes(1);
    const [input, actor] = crm.createCustomer.mock.calls[0] as [Record<string, unknown>, string];
    expect(input.phone).toBe("+994501234567");
    expect(input.email).toBe("guest@example.test");
    expect(actor).toBe("guest-checkout");

    const [dto, reqActor] = requests.createRequest.mock.calls[0] as [
      Record<string, unknown>,
      { id: string | null; username: string },
    ];
    expect(dto.customerId).toBe(res.customer.id);
    expect(dto.quantity).toBe(1);
    expect(dto.travelerCount).toBe(1);
    expect(reqActor).toEqual({ id: null, username: "guest-checkout" });

    // Audit: system-actor, без PII (email/phone не в details).
    expect(security.audit).toHaveBeenCalledTimes(1);
    const [, entry] = security.audit.mock.calls[0] as unknown as [unknown, Record<string, any>];
    expect(entry.userId).toBeNull();
    expect(entry.username).toBe("guest-checkout");
    expect(entry.action).toBe("checkout.guest_created");
    expect(entry.resourceId).toBe("req-1");
    expect(JSON.stringify(entry.details)).not.toContain("guest@example.test");
    expect(JSON.stringify(entry.details)).not.toContain("050");
  });

  it("country=RU: локальный формат нормализуется регионом страны", async () => {
    const { service, crm } = makeService([]);
    await service.checkout({ email: "ru@b.test", phone: "9210001122", country: "ru" });
    const [input] = crm.createCustomer.mock.calls[0] as [Record<string, unknown>];
    expect(input.phone).toBe("+79210001122");
  });

  it("MATCHED по телефону → reuse (без create), source=phone", async () => {
    const { service, crm, requests } = makeService([
      { id: "cu-1", email: "one@b.test", phoneCanonical: "+994501111222" },
    ]);
    const res = await service.checkout({ email: "other@b.test", phone: "+994501111222" });
    expect(res.customer).toEqual({ id: "cu-1", created: false });
    expect(res.resolvedSource).toBe("phone");
    expect(crm.createCustomer).not.toHaveBeenCalled();
    const [dto] = requests.createRequest.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(dto.customerId).toBe("cu-1");
  });

  it("email-fallback: телефон новый, email существует → reuse read-only, source=email", async () => {
    const { service, crm } = makeService([
      { id: "cu-mail", email: "reuse@b.test", phoneCanonical: null },
    ]);
    const res = await service.checkout({ email: "REUSE@b.test", phone: "0509998877" });
    expect(res.customer).toEqual({ id: "cu-mail", created: false });
    expect(res.resolvedSource).toBe("email");
    expect(crm.createCustomer).not.toHaveBeenCalled();
  });

  it("AMBIGUOUS (>1 владельцев телефона) → ConflictError; без create/merge", async () => {
    const { service, crm, requests } = makeService([
      { id: "cu-a", email: "a@b.test", phoneCanonical: "+994502222333" },
      { id: "cu-b", email: "b@b.test", phoneCanonical: "+994502222333" },
    ]);
    await expect(
      service.checkout({ email: "c@b.test", phone: "0502222333" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(crm.createCustomer).not.toHaveBeenCalled();
    expect(requests.createRequest).not.toHaveBeenCalled();
  });

  it("неизвестный productId → NotFoundError; customer НЕ создаётся (нет orphan)", async () => {
    const { service, crm, requests } = makeService([]);
    await expect(
      service.checkout({ email: "p@b.test", phone: "0503334455", productId: "prod-missing" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(crm.createCustomer).not.toHaveBeenCalled();
    expect(requests.createRequest).not.toHaveBeenCalled();
  });

  it("известный productId → уходит в Request; travelerCount/quantity из DTO", async () => {
    const { service, requests } = makeService([], { knownProducts: ["prod-1"] });
    await service.checkout({
      email: "p2@b.test",
      phone: "0505556677",
      productId: "prod-1",
      quantity: 3,
      travelerCount: 2,
      requestedServiceDate: "2027-01-15",
    });
    const [dto] = requests.createRequest.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(dto.productId).toBe("prod-1");
    expect(dto.quantity).toBe(3);
    expect(dto.travelerCount).toBe(2);
    expect(dto.requestedServiceDate).toBe("2027-01-15");
  });
});
