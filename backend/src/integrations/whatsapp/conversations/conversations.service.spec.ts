import { WhatsAppConversationsService } from "./conversations.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";

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
  const service = new WhatsAppConversationsService(
    prisma as never,
    {} as never,
    config,
    {} as never,
    {} as never,
  );
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
      {} as never,
      {} as never,
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

describe("WhatsAppConversationsService.bindPhone (§10, ручной бинд Lid → номер)", () => {
  const now = new Date("2026-10-08T10:00:00Z");

  const lidConversation: Record<string, unknown> = {
    id: "conv-lid",
    accountId: "acc-1",
    remoteJid: "157848755548268@lid",
    canonicalPhone: null,
    matchingStatus: "UNMATCHED",
    customerId: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    lastReadAt: null,
    createdAt: now,
    updatedAt: now,
  };

  function makeHarness(opts: {
    conversation?: Record<string, unknown> | null;
    duplicate?: Record<string, unknown> | null;
  } = {}) {
    const conversation = opts.conversation === undefined ? lidConversation : opts.conversation;
    const tx = {
      whatsAppConversation: { update: jest.fn(async () => undefined) },
      whatsAppContact: { upsert: jest.fn(async () => undefined) },
    };
    const prisma = {
      whatsAppConversation: {
        findUnique: jest.fn(async () => conversation),
        findFirst: jest.fn(async () => opts.duplicate ?? null),
      },
      whatsAppInboundMessage: { count: jest.fn(async () => 0) },
      whatsAppSuppression: { findUnique: jest.fn(async () => null) },
      customer: { findUnique: jest.fn(async () => null) },
      order: { findMany: jest.fn(async () => []) },
      request: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    const security = { audit: jest.fn() };
    const service = new WhatsAppConversationsService(
      prisma as never,
      security as never,
      { defaultPhoneRegion: "AZ" } as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, tx, security };
  }

  it("lid-диалог без номера → canonicalPhone в conversation + contact (MANUAL) + audit phone_bound", async () => {
    const { service, tx, security } = makeHarness();

    const result = await service.bindPhone("conv-lid", "+994509998877", {
      id: "u1",
      username: "op",
    });

    expect(tx.whatsAppConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-lid" },
      data: { canonicalPhone: "+994509998877" },
    });
    expect(tx.whatsAppContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          canonicalPhone: "+994509998877",
          linkSource: "MANUAL",
        }),
      }),
    );
    expect(security.audit).toHaveBeenCalledTimes(1);
    expect(security.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "whatsapp.phone_bound" }),
    );
    expect(result).toMatchObject({ id: "conv-lid" });
    expect(result.customer).toBeNull();
  });

  it("невалидный номер → 422, без записи в БД", async () => {
    const { service, tx } = makeHarness();

    await expect(service.bindPhone("conv-lid", "abc", { id: "u1" })).rejects.toBeInstanceOf(
      ValidationDomainError,
    );
    expect(tx.whatsAppConversation.update).not.toHaveBeenCalled();
  });

  it("диалог уже имеет canonicalPhone → 409", async () => {
    const { service, tx } = makeHarness({
      conversation: {
        ...lidConversation,
        id: "conv-pn",
        remoteJid: "994501234567@s.whatsapp.net",
        canonicalPhone: "+994501234567",
      },
    });

    await expect(service.bindPhone("conv-pn", "+994509998877", { id: "u1" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(tx.whatsAppConversation.update).not.toHaveBeenCalled();
  });

  it("не-lid диалог (canonicalPhone=null, но jid обычный) → 409", async () => {
    const { service } = makeHarness({
      conversation: {
        ...lidConversation,
        id: "conv-group",
        remoteJid: "120363000000@g.us",
      },
    });

    await expect(
      service.bindPhone("conv-group", "+994509998877", { id: "u1" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("номер уже занят другим диалогом аккаунта → 409", async () => {
    const { service, tx } = makeHarness({ duplicate: { id: "conv-other" } });

    await expect(
      service.bindPhone("conv-lid", "+994509998877", { id: "u1" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(tx.whatsAppConversation.update).not.toHaveBeenCalled();
  });

  it("диалог не найден → 404", async () => {
    const { service } = makeHarness({ conversation: null });

    await expect(
      service.bindPhone("conv-missing", "+994509998877", { id: "u1" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("M4.2 — WhatsAppConversationsService.unlinkCustomer", () => {
  const now = new Date("2026-10-04T10:00:00Z");

  function makeUnlinkHarness(
    conversation: Record<string, unknown>,
    customers: Array<{ id: string; phone?: string | null; phoneCanonical?: string | null }>,
  ) {
    const state = { ...conversation };
    const tx = {
      whatsAppConversation: {
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(state, data);
          return { ...state };
        }),
      },
      whatsAppContact: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    const prisma = {
      whatsAppConversation: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === state.id ? { ...state } : null,
        ),
      },
      whatsAppInboundMessage: { count: jest.fn(async () => 0) },
      whatsAppSuppression: { findUnique: jest.fn(async () => null) },
      customer: {
        findMany: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
          if (where?.phoneCanonical !== undefined) {
            return customers.filter((c) =>
              where.phoneCanonical === null
                ? (c.phoneCanonical ?? null) === null && (c.phone ?? null) !== null
                : c.phoneCanonical === where.phoneCanonical,
            );
          }
          return customers;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          const c = customers.find((x) => x.id === where.id);
          return c
            ? { id: c.id, code: "CRM-1", firstName: null, lastName: null, companyName: null, email: `${c.id}@test.local` }
            : null;
        }),
      },
      order: { findMany: jest.fn(async () => []) },
      request: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    const security = { audit: jest.fn() };
    const service = new WhatsAppConversationsService(
      prisma as never,
      security as never,
      { defaultPhoneRegion: "AZ" } as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, tx, security, state };
  }

  const matchedConversation: Record<string, unknown> = {
    id: "conv-1",
    accountId: "acc-1",
    remoteJid: "994501111111@s.whatsapp.net",
    canonicalPhone: "+994501111111",
    matchingStatus: "MATCHED",
    customerId: "cu-1",
    matchedAt: now,
    lastMessageAt: now,
    lastMessagePreview: "hi",
    lastReadAt: null,
    createdAt: now,
    updatedAt: now,
  };

  it("unlink: clears conversation + contact, status → UNMATCHED, audit", async () => {
    const { service, tx, security, state } = makeUnlinkHarness(matchedConversation, [
      { id: "cu-1", phone: "+994501111111", phoneCanonical: "+994501111111" },
    ]);

    const result = await service.unlinkCustomer("conv-1", { id: "u1", username: "op" });

    expect(tx.whatsAppConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { customerId: null, matchingStatus: "UNMATCHED", matchedAt: null },
    });
    expect(tx.whatsAppContact.updateMany).toHaveBeenCalledWith({
      where: { accountId: "acc-1", jid: "994501111111@s.whatsapp.net", customerId: { not: null } },
      data: { customerId: null },
    });
    expect(security.audit).toHaveBeenCalledTimes(1);
    expect(security.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "whatsapp.customer_unlinked",
        resource: "WhatsAppConversation",
        resourceId: "conv-1",
        details: expect.objectContaining({
          fromCustomerId: "cu-1",
          fromMatchingStatus: "MATCHED",
          toMatchingStatus: "UNMATCHED",
        }),
      }),
    );
    expect(state.customerId).toBeNull();
    expect(state.matchingStatus).toBe("UNMATCHED");
    expect(result.customer).toBeNull();
    expect(result.matchingStatus).toBe("UNMATCHED");
  });

  it("unlink: canonical phone owned by 2 customers → AMBIGUOUS (no auto-pick)", async () => {
    const { service, tx, state } = makeUnlinkHarness(matchedConversation, [
      { id: "cu-1", phone: "+994501111111", phoneCanonical: "+994501111111" },
      { id: "cu-2", phone: "0501111111", phoneCanonical: "+994501111111" },
    ]);

    const result = await service.unlinkCustomer("conv-1", { id: "u1", username: "op" });

    expect(state.matchingStatus).toBe("AMBIGUOUS");
    expect(tx.whatsAppConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { customerId: null, matchingStatus: "AMBIGUOUS", matchedAt: null },
    });
    expect(result.candidates.map((c) => c.id).sort()).toEqual(["cu-1", "cu-2"]);
  });

  it("unlink: идемпотентно — уже разъединённый диалог → no-op без tx/audit", async () => {
    const { service, prisma, security } = makeUnlinkHarness(
      { ...matchedConversation, id: "conv-2", customerId: null, matchingStatus: "UNMATCHED", matchedAt: null },
      [{ id: "cu-1", phone: "+994501111111", phoneCanonical: "+994501111111" }],
    );

    const result = await service.unlinkCustomer("conv-2", { id: "u1", username: "op" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(security.audit).not.toHaveBeenCalled();
    expect(result.customerId).toBeNull();
    expect(result.matchingStatus).toBe("UNMATCHED");
  });

  it("unlink: неизвестный диалог → NotFound", async () => {
    const { service } = makeUnlinkHarness(matchedConversation, []);
    await expect(service.unlinkCustomer("nope", { id: "u1" })).rejects.toThrow("not found");
  });
});

describe("M4.4 — WhatsAppConversationsService.onboardCustomer (§18 first contact)", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const PHONE = "+994507778899";

  interface OnboardOpts {
    conversation?: Record<string, unknown>;
    phoneOwners?: Array<{ id: string; phoneCanonical?: string | null; phone?: string | null }>;
    emailOwner?: { id: string } | null;
    loginUser?: { id: string; status: string } | null;
  }

  function makeOnboardHarness(opts: OnboardOpts = {}) {
    const state = {
      id: "conv-ob",
      accountId: "acc-1",
      remoteJid: "994507778899@s.whatsapp.net",
      canonicalPhone: PHONE,
      matchingStatus: "UNMATCHED",
      customerId: null,
      matchedAt: null as Date | null,
      lastMessageAt: now,
      lastMessagePreview: "hi",
      lastReadAt: null,
      suppressed: false,
      createdAt: now,
      updatedAt: now,
      ...(opts.conversation ?? {}),
    };
    const owners = opts.phoneOwners ?? [];
    const tx = {
      whatsAppConversation: {
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(state, data);
          return { ...state };
        }),
      },
      whatsAppContact: { upsert: jest.fn(async () => undefined) },
      whatsAppInboundMessage: { findMany: jest.fn(async () => []) },
      whatsAppOutboundMessage: { findMany: jest.fn(async () => []) },
      communication: { updateMany: jest.fn(async () => ({ count: 0 })) },
    };
    const prisma = {
      whatsAppConversation: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === state.id ? { ...state } : null,
        ),
      },
      customer: {
        // resolver: indexed по phoneCanonical + legacy-fallback (phone not null) + email/код-текст.
        findMany: jest.fn(async (args: Record<string, any>) => {
          if (args?.where?.phoneCanonical !== undefined) {
            return owners
              .filter((o) => o.phoneCanonical === args.where.phoneCanonical)
              .map((o) => ({ id: o.id }));
          }
          if (args?.where?.phone !== undefined) {
            return owners.filter((o) => o.phone !== null).map((o) => ({ id: o.id, phone: o.phone }));
          }
          if (args?.where?.OR !== undefined) return [];
          return owners.map((o) => ({ id: o.id }));
        }),
        findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.email !== undefined) return opts.emailOwner ?? null;
          if (where.id !== undefined) {
            // link/customerRef lookup по id: stub для любого id (owner или созданный).
            const owner = owners.find((o) => o.id === where.id);
            return {
              id: where.id,
              code: owner ? "CRM-OB" : "CRM-NEW",
              firstName: null,
              lastName: null,
              companyName: null,
              email: `${where.id}@test.local`,
            };
          }
          return null;
        }),
      },
      user: {
        findUnique: jest.fn(async ({ where }: { where: Record<string, string> }) =>
          where.loginPhone !== undefined ? opts.loginUser ?? null : null,
        ),
      },
      whatsAppInboundMessage: { count: jest.fn(async () => 0) },
      whatsAppSuppression: { findUnique: jest.fn(async () => null) },
      order: { findMany: jest.fn(async () => []) },
      request: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    const crm = {
      createCustomer: jest.fn(async () => ({
        customer: { id: "cu-created", code: "CUS-99999999" },
        eventId: "evt-1",
        initialNote: null,
      })),
    };
    const activation = {
      issue: jest.fn(async () => ({ token: "plaintext-token", expiresAt: new Date("2026-10-05T12:00:00Z") })),
    };
    const security = { audit: jest.fn() };
    const service = new WhatsAppConversationsService(
      prisma as never,
      security as never,
      { defaultPhoneRegion: "AZ" } as never,
      crm as never,
      activation as never,
    );
    return { service, prisma, tx, crm, activation, security, state };
  }

  const actor = { id: "u1", username: "op" };

  it("0 владельников → create Customer (CRM-owned, canonical phone) + link + audit", async () => {
    const { service, crm, tx, security, state } = makeOnboardHarness();

    const result = await service.onboardCustomer(
      "conv-ob",
      { email: "New@Buyer.TEST", firstName: "Али", lastName: "Мамедов" },
      actor,
    );

    expect(crm.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@buyer.test", phone: PHONE, type: "PERSON" }),
      "op",
    );
    // link: диалог → MATCHED (contact upsert MANUAL, pointer-бэкфилл §14)
    expect(tx.whatsAppConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-ob" },
      data: expect.objectContaining({ customerId: "cu-created", matchingStatus: "MATCHED" }),
    });
    expect(result.created).toBe(true);
    expect(result.customerId).toBe("cu-created");
    expect(result.conversation.matchingStatus).toBe("MATCHED");
    expect(state.customerId).toBe("cu-created");
    // audit: link (внутри tx) + onboard (метаданные, без PII)
    expect(security.audit).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        action: "whatsapp.customer_onboarded",
        resourceId: "conv-ob",
        details: expect.objectContaining({ customerId: "cu-created", created: true, activationIssued: false }),
      }),
    );
  });

  it("1 владелец по телефону → reuse (без create), link если диалог UNMATCHED", async () => {
    const { service, crm, state } = makeOnboardHarness({
      phoneOwners: [{ id: "cu-exists", phoneCanonical: PHONE }],
    });

    const result = await service.onboardCustomer(
      "conv-ob",
      { email: "other@buyer.test" },
      actor,
    );

    expect(crm.createCustomer).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.customerId).toBe("cu-exists");
    expect(state.matchingStatus).toBe("MATCHED");
  });

  it(">1 владельцев → AMBIGUOUS → ConflictError (ручной выбор через link)", async () => {
    const { service, crm } = makeOnboardHarness({
      phoneOwners: [
        { id: "cu-a", phoneCanonical: PHONE },
        { id: "cu-b", phoneCanonical: PHONE },
      ],
    });

    await expect(
      service.onboardCustomer("conv-ob", { email: "x@y.test" }, actor),
    ).rejects.toThrow("Multiple customers match");
    expect(crm.createCustomer).not.toHaveBeenCalled();
  });

  it("диалог уже linked с ДРУГИМ customer → ConflictError (unlink first)", async () => {
    const { service, crm } = makeOnboardHarness({
      conversation: { customerId: "cu-other", matchingStatus: "MATCHED" },
    });

    await expect(
      service.onboardCustomer("conv-ob", { email: "x@y.test" }, actor),
    ).rejects.toThrow("unlink first");
    expect(crm.createCustomer).not.toHaveBeenCalled();
  });

  it("без canonicalPhone и без override → ValidationDomainError (не угадываем)", async () => {
    const { service } = makeOnboardHarness({
      conversation: { canonicalPhone: null, remoteJid: "50135237189839@lid" },
    });

    await expect(
      service.onboardCustomer("conv-ob", { email: "x@y.test" }, actor),
    ).rejects.toThrow("Phone number is required");
  });

  it("activateUser + существующий INACTIVE user (loginPhone) → activation.issue", async () => {
    const { service, activation, crm } = makeOnboardHarness({
      loginUser: { id: "usr-1", status: "INACTIVE" },
    });

    const result = await service.onboardCustomer(
      "conv-ob",
      { email: "x@y.test", activateUser: true },
      actor,
    );

    expect(activation.issue).toHaveBeenCalledWith("usr-1", { id: "u1", username: "op" });
    expect(result.activation).toEqual({
      token: "plaintext-token",
      expiresAt: "2026-10-05T12:00:00.000Z",
    });
    expect(result.user).toEqual({ id: "usr-1", status: "INACTIVE" });
    expect(crm.createCustomer).toHaveBeenCalledTimes(1); // phone-владельцев нет, email-miss → create
  });

  it("activateUser + ACTIVE user → без issue (уже активен)", async () => {
    const { service, activation } = makeOnboardHarness({
      phoneOwners: [{ id: "cu-exists", phoneCanonical: PHONE }],
      loginUser: { id: "usr-2", status: "ACTIVE" },
    });

    const result = await service.onboardCustomer(
      "conv-ob",
      { email: "x@y.test", activateUser: true },
      actor,
    );

    expect(activation.issue).not.toHaveBeenCalled();
    expect(result.activation).toBeNull();
    expect(result.user).toEqual({ id: "usr-2", status: "ACTIVE" });
  });

  it("activateUser, но user не существует → без регистрации (user/activation = null)", async () => {
    const { service, activation } = makeOnboardHarness({ loginUser: null });

    const result = await service.onboardCustomer(
      "conv-ob",
      { email: "x@y.test", activateUser: true },
      actor,
    );

    expect(activation.issue).not.toHaveBeenCalled();
    expect(result.user).toBeNull();
    expect(result.activation).toBeNull();
  });

  it("неизвестный диалог → NotFound", async () => {
    const { service } = makeOnboardHarness();
    await expect(service.onboardCustomer("nope", { email: "x@y.test" }, actor)).rejects.toThrow(
      "not found",
    );
  });
});

/**
 * Stage 1 — Order → Request: resolveContext обязан снова отдавать REQUEST
 * для вернувшейся из Order заявки (convertedOrderId НЕ null, status CHECKING).
 * Регресс: CONVERTED-заявки (link установлен) остаются вне контекста — их
 * отсекает терминальный статус, а не link-фильтр.
 */
describe("Stage 1 — resolveContext (вернувшаяся из Order Request)", () => {
  function makeContextService(args: {
    orders: Array<{ id: string; code: string; status: string }>;
    requests: Array<{ id: string; code: string; status: string; convertedOrderId: string | null }>;
  }) {
    const prisma = {
      order: {
        findMany: jest.fn(async () => args.orders),
      },
      booking: {
        findMany: jest.fn(async () => []),
      },
      request: {
        findFirst: jest.fn(async (q: { where: Record<string, any> }) => {
          const notIn: string[] = q?.where?.status?.notIn ?? [];
          return (
            args.requests.find((r) => !notIn.includes(r.status)) ?? null
          );
        }),
      },
    };
    const service = new WhatsAppConversationsService(
      prisma as never,
      {} as never,
      { defaultPhoneRegion: "AZ" } as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  }

  it("CHECKING + link (возврат из Order): контекст — REQUEST той же строки", async () => {
    const { service, prisma } = makeContextService({
      orders: [],
      requests: [
        { id: "req-1", code: "REQ-1", status: "CHECKING", convertedOrderId: "ord-1" },
      ],
    });
    const ctx = await service.resolveContext("cu-1");
    expect(ctx).toEqual({ type: "REQUEST", id: "req-1", code: "REQ-1", status: "CHECKING" });
    expect(prisma.request.findFirst).toHaveBeenCalled();
  });

  it("CONVERTED + link: контекст не REQUEST (терминальный статус, link-фильтр снят)", async () => {
    const { service } = makeContextService({
      orders: [],
      requests: [
        { id: "req-2", code: "REQ-2", status: "CONVERTED", convertedOrderId: "ord-2" },
      ],
    });
    await expect(service.resolveContext("cu-1")).resolves.toEqual({
      type: "CUSTOMER",
      id: "cu-1",
      code: "",
      status: null,
    });
  });

  it("активный Order имеет приоритет над вернувшейся Request (Booking→Order→Request)", async () => {
    const { service } = makeContextService({
      orders: [{ id: "ord-9", code: "ORD-9", status: "IN_PROCESSING" }],
      requests: [
        { id: "req-3", code: "REQ-3", status: "CHECKING", convertedOrderId: "ord-9" },
      ],
    });
    await expect(service.resolveContext("cu-1")).resolves.toEqual({
      type: "ORDER",
      id: "ord-9",
      code: "ORD-9",
      status: "IN_PROCESSING",
    });
  });
});
