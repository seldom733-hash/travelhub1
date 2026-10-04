import { WhatsAppConversationsService } from "./conversations.service";

/**
 * M3 §25 — ручной поиск клиента для link-customer:
 * текст (код/имя/email, case-insensitive) + телефон (канонический E.164,
 * та же read-only нормализация, что в §10 matching).
 */

interface FakeCustomer {
  id: string;
  code: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string;
  phone: string | null;
}

function makeService(customers: FakeCustomer[]) {
  const prisma = {
    customer: {
      findMany: jest.fn(async (args: Record<string, any>) => {
        // Запрос №1 (findCustomerIdsByCanonicalPhone): where.phone = { not: null }.
        if (args?.where?.phone !== undefined) {
          return customers
            .filter((c) => c.phone !== null)
            .map((c) => ({ id: c.id, phone: c.phone }));
        }
        // Запрос №2: OR contains по текстовым полям (mode: insensitive).
        const or: Array<Record<string, { contains: string }>> = args?.where?.OR ?? [];
        const matches = customers.filter((c) =>
          or.some((cond) => {
            const field = Object.keys(cond)[0];
            if (!field) return false;
            const value = (c as unknown as Record<string, string | null>)[field];
            if (value === null || value === undefined) return false;
            return value.toLowerCase().includes(cond[field]!.contains.toLowerCase());
          }),
        );
        const take: number = args?.take ?? matches.length;
        return matches.slice(0, take).map((c) => ({ id: c.id }));
      }),
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        const c = customers.find((x) => x.id === args.where.id);
        if (!c) return null;
        return {
          id: c.id,
          code: c.code,
          firstName: c.firstName,
          lastName: c.lastName,
          companyName: c.companyName,
          email: c.email,
        };
      }),
    },
  };
  const config = { defaultPhoneRegion: "AZ" } as never;
  const service = new WhatsAppConversationsService(prisma as never, {} as never, config);
  return { service, prisma };
}

const customers: FakeCustomer[] = [
  {
    id: "cu-1",
    code: "CRM-0001",
    firstName: "Иван",
    lastName: "Петров",
    companyName: null,
    email: "ivan@test.local",
    phone: "+994501112233",
  },
  {
    id: "cu-2",
    code: "CRM-0002",
    firstName: "Anna",
    lastName: "Smith",
    companyName: null,
    email: "anna@test.local",
    phone: "050 111 22 33", // локальный формат AZ → +994501112233
  },
  {
    id: "cu-3",
    code: "CRM-0003",
    firstName: null,
    lastName: null,
    companyName: "Smith Travel LLC",
    email: "info@smith.test",
    phone: null,
  },
];

describe("WhatsAppConversationsService.searchCustomers (§25)", () => {
  it("пустой/пробельный запрос → [] без запросов к БД", async () => {
    const { service, prisma } = makeService(customers);
    await expect(service.searchCustomers("")).resolves.toEqual([]);
    await expect(service.searchCustomers("   ")).resolves.toEqual([]);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it("телефон: канонический E.164 (с '+' и локальный формат) → оба владельца номера", async () => {
    const { service } = makeService(customers);
    const byE164 = await service.searchCustomers("+994501112233");
    const byLocal = await service.searchCustomers("0501112233");
    expect(byE164.map((c) => c.id).sort()).toEqual(["cu-1", "cu-2"]);
    expect(byLocal.map((c) => c.id).sort()).toEqual(["cu-1", "cu-2"]);
    // Без PII в ответе — только CustomerRef (как в detail/candidates).
    expect(Object.keys(byE164[0]!).sort()).toEqual(["code", "email", "id", "name"]);
  });

  it("текст: код/имя/company/email, case-insensitive, без дублей; take ≤10", async () => {
    const { service } = makeService(customers);
    const byName = await service.searchCustomers("smith");
    expect(byName.map((c) => c.id).sort()).toEqual(["cu-2", "cu-3"]);
    const byCode = await service.searchCustomers("crm-0001");
    expect(byCode.map((c) => c.id)).toEqual(["cu-1"]);
    const byEmail = await service.searchCustomers("ivan@test");
    expect(byEmail.map((c) => c.id)).toEqual(["cu-1"]);
    const none = await service.searchCustomers("no-such-customer");
    expect(none).toEqual([]);
  });

  it("совпадение и по телефону, и по тексту → один результат (dedupe)", async () => {
    const withTextPhone: FakeCustomer[] = [
      // код содержит цифры запроса → найден и текстом, и телефоном;
      { ...customers[0]!, code: "CRM-0501112233" },
      { ...customers[1]! },
    ];
    const { service } = makeService(withTextPhone);
    // "0501112233" → телефон (локальный AZ → +994501112233: оба владельца)
    // И текст (код cu-1) → union без дублей.
    const found = await service.searchCustomers("0501112233");
    expect(found.map((c) => c.id).sort()).toEqual(["cu-1", "cu-2"]);
    expect(new Set(found.map((c) => c.id)).size).toBe(found.length);
  });
});

describe("WhatsAppConversationsService.linkCustomer (§10, LID-бэкофилл)", () => {
  const now = new Date("2026-10-03T10:00:00Z");

  function makeLinkHarness(
    conversation: Record<string, unknown>,
    customer: Record<string, unknown>,
  ) {
    const tx = {
      whatsAppConversation: { update: jest.fn(async () => undefined) },
      whatsAppContact: { upsert: jest.fn(async () => undefined) },
      whatsAppInboundMessage: { findMany: jest.fn(async () => []) },
      whatsAppOutboundMessage: { findMany: jest.fn(async () => []) },
      communication: { updateMany: jest.fn(async () => ({ count: 0 })) },
    };
    const prisma = {
      whatsAppConversation: { findUnique: jest.fn(async () => conversation) },
      customer: { findUnique: jest.fn(async () => customer) },
      whatsAppInboundMessage: { count: jest.fn(async () => 0) },
      whatsAppSuppression: { findUnique: jest.fn(async () => null) },
      order: { findMany: jest.fn(async () => []) },
      request: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    const security = { audit: jest.fn() };
    const service = new WhatsAppConversationsService(
      prisma as never,
      security as never,
      { defaultPhoneRegion: "AZ" } as never,
    );
    return { service, prisma, tx, security };
  }

  const lidConversation: Record<string, unknown> = {
    id: "conv-lid",
    accountId: "acc-1",
    remoteJid: "50135237189839@lid",
    canonicalPhone: null,
    matchingStatus: "UNMATCHED",
    customerId: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    lastReadAt: null,
    createdAt: now,
    updatedAt: now,
  };

  it("lid-диалог без canonicalPhone → бэкофилл номера клиента в conversation + contact", async () => {
    const { service, tx, security } = makeLinkHarness(lidConversation, {
      id: "cu-1",
      code: "CRM-0001",
      phone: "050 111 22 33", // локальный AZ → +994501112233
      firstName: "Anna",
      lastName: null,
      companyName: null,
      email: "anna@test.local",
    });

    await service.linkCustomer("conv-lid", "cu-1", { id: "u1", username: "op" });

    expect(tx.whatsAppConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-lid" },
      data: expect.objectContaining({
        customerId: "cu-1",
        matchingStatus: "MATCHED",
        canonicalPhone: "+994501112233",
      }),
    });
    expect(tx.whatsAppContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          canonicalPhone: "+994501112233",
          linkSource: "MANUAL",
          customerId: "cu-1",
        }),
      }),
    );
    expect(security.audit).toHaveBeenCalledTimes(1);
  });

  it("уже есть canonicalPhone → номер НЕ перезаписывается при линке", async () => {
    const { service, tx } = makeLinkHarness(
      { ...lidConversation, id: "conv-pn", remoteJid: "994501234567@s.whatsapp.net", canonicalPhone: "+994501234567" },
      { id: "cu-1", code: "CRM-0001", phone: "050 111 22 33", firstName: null, lastName: null, companyName: null, email: "x@test.local" },
    );

    await service.linkCustomer("conv-pn", "cu-1", { id: "u1", username: "op" });

    const updateArgs = (tx.whatsAppConversation.update as jest.Mock).mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data).not.toHaveProperty("canonicalPhone");
    expect(updateArgs.data).toMatchObject({ customerId: "cu-1", matchingStatus: "MATCHED" });
  });
});
