/**
 * M4.1 (ADR-0016) — phone-first identity write paths + backfill commands.
 * MOCK-based unit tests: normalization into phoneCanonical at every CRM
 * write site, idempotent backfill with conflict reporting, no auto-merge.
 * M4.2 — resolver guards: duplicate-phone rejection + phone/email reuse.
 */

import { CrmService } from "./crm.service";
import { SecurityService } from "../../security/security.service";
import { normalizePhoneE164 } from "../../shared/phone/phone";
import { ConflictError } from "../../shared/errors";

interface CustomerRow {
  id: string;
  code: string;
  email: string | null;
  phone: string | null;
  phoneCanonical: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  status?: string;
  type?: string;
  customerType?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

function makeCrmService(customers: CustomerRow[]) {
  const prisma: any = {
    customer: {
      // Where-aware (M4.2): resolver queries by phoneCanonical are filtered
      // honestly; no where (backfill) — full scan.
      findMany: jest.fn(async ({ where }: any = {}) => {
        if (where?.phoneCanonical !== undefined) {
          return customers.filter((c) =>
            where.phoneCanonical === null
              ? (c.phoneCanonical ?? null) === null && (c.phone ?? null) !== null
              : c.phoneCanonical === where.phoneCanonical,
          );
        }
        return customers;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.email !== undefined) return customers.find((c) => c.email === where.email) ?? null;
        return customers.find((c) => c.id === where.id) ?? null;
      }),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => {
        const row: CustomerRow = { id: `cus-${customers.length + 1}`, ...data };
        customers.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = customers.find((c) => c.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }),
      count: jest.fn(async () => customers.length),
    },
    buyerProfile: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
    customerHistory: { create: jest.fn(async () => ({ id: "hist-1" })) },
    operationalNote: { create: jest.fn(async () => ({ id: "note-1" })) },
    // M4.6 advisory lock (pg_advisory_xact_lock) — no-op в mock.
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const ids = { generateId: jest.fn((prefix: string) => `${prefix}-gen`), nextCode: jest.fn(async (_tx: any, prefix: string) => `${prefix}00${customers.length + 1}`) } as any;
  const eventBus = { publish: jest.fn(), emit: jest.fn(async () => "evt-1"), publishPending: jest.fn(async () => undefined) } as any;
  const service = new CrmService(prisma as any, ids, eventBus);
  return { service, prisma };
}

function makeSecurityService(users: any[], customers: any[]) {
  const prisma = {
    user: {
      findMany: jest.fn(async () => users),
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) throw new Error("not found");
        Object.assign(u, data);
        return u;
      }),
    },
    customer: {
      findUnique: jest.fn(async ({ where }: any) => customers.find((c) => c.id === where.id) ?? null),
    },
    auditLog: { create: jest.fn(async () => ({ id: "audit-1" })) },
    role: { upsert: jest.fn(), findUnique: jest.fn() },
    permission: { findMany: jest.fn(async () => []), createMany: jest.fn() },
    rolePermission: { createMany: jest.fn(), upsert: jest.fn() },
    $transaction: undefined as unknown,
  };
  const ids = { generateId: jest.fn((p: string) => `${p}-gen`) } as any;
  const crm = {} as any;
  const svc = new SecurityService(prisma as any, ids, crm);
  return { svc, prisma };
}

describe("M4.1 — phoneCanonical at CRM write sites", () => {
  it("createCustomer stores canonical phone (local format → +994...)", async () => {
    const customers: CustomerRow[] = [];
    const { service } = makeCrmService(customers);
    await service.createCustomer({
      email: "a@b.az",
      firstName: "A",
      lastName: "B",
      phone: "050 123 45 67",
      customerType: "INDIVIDUAL",
    } as any, "tester");
    expect(customers[0].phoneCanonical).toBe("+994501234567");
  });

  it("createCustomer stores phoneCanonical=null for invalid phone", async () => {
    const customers: CustomerRow[] = [];
    const { service } = makeCrmService(customers);
    await service.createCustomer({
      email: "a2@b.az",
      firstName: "A",
      lastName: "B",
      phone: "not-a-phone",
      customerType: "INDIVIDUAL",
    } as any, "tester");
    expect(customers[0].phoneCanonical).toBeNull();
  });

  it("updateCustomer recomputes phoneCanonical only when phone changes", async () => {
    const customers: CustomerRow[] = [{
      id: "cus-1", code: "CUS-1", email: "x@y.az",
      phone: "+994501111111", phoneCanonical: "+994501111111",
    }];
    const { service } = makeCrmService(customers);
    await service.updateCustomer("cus-1", { version: 1, firstName: "New" } as any, "tester");
    expect(customers[0].phoneCanonical).toBe("+994501111111");
    await service.updateCustomer("cus-1", { version: 1, phone: "050 222 33 44" } as any, "tester");
    expect(customers[0].phoneCanonical).toBe("+994502223344");
  });

  it("ensureCustomerForBuyer (email-keyed) stores phoneCanonical too", async () => {
    const customers: CustomerRow[] = [];
    const { service, prisma } = makeCrmService(customers);
    const result = await service.ensureCustomerForBuyer(prisma, {
      email: "buyer@x.az",
      firstName: "Buyer",
      lastName: "Name",
      phone: "+99450 999 88 77",
    });
    expect(result.created).toBe(true);
    expect(customers[0].phoneCanonical).toBe("+994509998877");
  });
});

describe("M4.1 — backfillPhoneCanonical (CRM-owned command)", () => {
  it("dry-run reports without writing", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "1", email: null, phone: "050 123 45 67", phoneCanonical: null },
    ];
    const { service, prisma } = makeCrmService(customers);
    const report = await service.backfillPhoneCanonical(true);
    expect(report.dryRun).toBe(true);
    expect(report.updated).toBe(1);
    expect(customers[0].phoneCanonical).toBeNull();
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it("real run writes canonical and clears it for invalid phones", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "1", email: null, phone: "(050) 123-45-67", phoneCanonical: null },
      { id: "c2", code: "2", email: null, phone: "garbage", phoneCanonical: "+994500000000" },
    ];
    const { service } = makeCrmService(customers);
    const report = await service.backfillPhoneCanonical(false);
    expect(customers[0].phoneCanonical).toBe("+994501234567");
    expect(customers[1].phoneCanonical).toBeNull();
    expect(report.updated).toBe(2);
    expect(report.invalid).toBe(1);
  });

  it("reports duplicate canonical groups as conflicts without merging", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "1", email: null, phone: "0507000000", phoneCanonical: null },
      { id: "c2", code: "2", email: null, phone: "+994507000000", phoneCanonical: null },
      { id: "c3", code: "3", email: null, phone: "+994501111111", phoneCanonical: null },
    ];
    const { service } = makeCrmService(customers);
    const report = await service.backfillPhoneCanonical(false);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].canonicalPhone).toBe("+994507000000");
    expect(report.conflicts[0].customerIds.sort()).toEqual(["c1", "c2"]);
    expect(customers).toHaveLength(3); // no auto-merge/deletes
    expect(customers[0].phoneCanonical).toBe("+994507000000");
    expect(customers[1].phoneCanonical).toBe("+994507000000");
  });

  it("is idempotent — second run updates nothing", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "1", email: null, phone: "+994501234567", phoneCanonical: null },
    ];
    const { service } = makeCrmService(customers);
    await service.backfillPhoneCanonical(false);
    const second = await service.backfillPhoneCanonical(false);
    expect(second.updated).toBe(0);
    expect(second.conflicts).toHaveLength(0);
  });
});

describe("M4.1 — backfillLoginPhones (security-owned command)", () => {
  it("sets loginPhone from linked Customer phoneCanonical", async () => {
    const users = [
      { id: "u1", username: "buyer1", loginPhone: null, customerId: "c1" },
    ];
    const customers = [
      { id: "c1", phoneCanonical: "+994501234567", phone: "050 123 45 67" },
    ];
    const { svc, prisma } = makeSecurityService(users, customers);
    const report = await svc.backfillLoginPhones(false);
    expect(report.updated).toBe(1);
    expect(users[0].loginPhone).toBe("+994501234567");
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it("falls back to normalizing raw Customer.phone when phoneCanonical missing", async () => {
    const users = [{ id: "u1", username: "buyer2", loginPhone: null, customerId: "c1" }];
    const customers = [{ id: "c1", phoneCanonical: null, phone: "050 999 88 77" }];
    const { svc } = makeSecurityService(users, customers);
    await svc.backfillLoginPhones(false);
    expect(users[0].loginPhone).toBe("+994509998877");
  });

  it("never overwrites an existing loginPhone", async () => {
    const users = [{ id: "u1", username: "admin", loginPhone: "+994500000001", customerId: "c1" }];
    const customers = [{ id: "c1", phoneCanonical: "+994501234567", phone: null }];
    const { svc, prisma } = makeSecurityService(users, customers);
    const report = await svc.backfillLoginPhones(false);
    expect(report.updated).toBe(0);
    expect(users[0].loginPhone).toBe("+994500000001");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("skips users without customerId or without a usable phone", async () => {
    const users = [
      { id: "u1", username: "admin", loginPhone: null, customerId: null },
      { id: "u2", username: "buyer3", loginPhone: null, customerId: "c1" },
      { id: "u3", username: "buyer4", loginPhone: null, customerId: "c2" },
    ];
    const customers = [
      { id: "c1", phoneCanonical: null, phone: "invalid" },
      { id: "c2", phoneCanonical: null, phone: null },
    ];
    const { svc } = makeSecurityService(users, customers);
    const report = await svc.backfillLoginPhones(false);
    expect(report.skippedNoCustomer).toBe(1);
    expect(report.skippedNoPhone).toBe(2);
    expect(report.updated).toBe(0);
    expect(users.every((u) => u.loginPhone === null)).toBe(true);
  });

  it("reports conflict when canonical already owned by another user (no overwrite)", async () => {
    const users = [
      { id: "u1", username: "owner", loginPhone: "+994501234567", customerId: null },
      { id: "u2", username: "dupe", loginPhone: null, customerId: "c1" },
    ];
    const customers = [{ id: "c1", phoneCanonical: "+994501234567", phone: null }];
    const { svc } = makeSecurityService(users, customers);
    const report = await svc.backfillLoginPhones(false);
    expect(report.conflicts).toEqual([
      { loginPhone: "+994501234567", ownerUsername: "owner", attemptedUsername: "dupe" },
    ]);
    expect(users[1].loginPhone).toBeNull();
  });

  it("dry-run reports without writing", async () => {
    const users = [{ id: "u1", username: "buyer1", loginPhone: null, customerId: "c1" }];
    const customers = [{ id: "c1", phoneCanonical: "+994501234567", phone: null }];
    const { svc, prisma } = makeSecurityService(users, customers);
    const report = await svc.backfillLoginPhones(true);
    expect(report.dryRun).toBe(true);
    expect(report.updated).toBe(1);
    expect(users[0].loginPhone).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("is idempotent — second run has nothing to update", async () => {
    const users = [{ id: "u1", username: "buyer1", loginPhone: null, customerId: "c1" }];
    const customers = [{ id: "c1", phoneCanonical: "+994501234567", phone: null }];
    const { svc } = makeSecurityService(users, customers);
    await svc.backfillLoginPhones(false);
    const second = await svc.backfillLoginPhones(false);
    expect(second.updated).toBe(0);
    expect(second.conflicts).toHaveLength(0);
  });
});

describe("M4.1 — normalizer single source of truth", () => {
  it("shared normalizer is used for canonical consistency", () => {
    expect(normalizePhoneE164("050 123 45 67")).toBe("+994501234567");
    expect(normalizePhoneE164("+994501234567")).toBe("+994501234567");
    expect(normalizePhoneE164("bad")).toBeNull();
  });
});

describe("M4.2 — resolver guards in CRM create/register paths", () => {
  it("createCustomer: canonical phone already owned → ConflictError, no duplicate created", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "owner@x.az", phone: "+994501111111", phoneCanonical: "+994501111111" },
    ];
    const { service } = makeCrmService(customers);
    await expect(
      service.createCustomer({ email: "new@x.az", phone: "0501111111" } as any, "tester"),
    ).rejects.toThrow(ConflictError);
    expect(customers).toHaveLength(1);
    expect(customers.some((c) => c.email === "new@x.az")).toBe(false);
  });

  it("createCustomer: free phone → created (no false-positive)", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "owner@x.az", phone: "+994501111111", phoneCanonical: "+994501111111" },
    ];
    const { service } = makeCrmService(customers);
    await service.createCustomer({ email: "new@x.az", phone: "0502222222" } as any, "tester");
    expect(customers).toHaveLength(2);
    expect(customers[1].phoneCanonical).toBe("+994502222222");
  });

  it("ensureCustomerForBuyer phone-reuse: new email + existing phone → link, not duplicate", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "old@x.az", phone: "050 111 11 11", phoneCanonical: "+994501111111" },
    ];
    const { service, prisma } = makeCrmService(customers);
    const result = await service.ensureCustomerForBuyer(prisma, {
      email: "new@x.az",
      firstName: "New",
      phone: "+994501111111",
    });
    expect(result).toEqual({ customerId: "c1", created: false });
    expect(customers).toHaveLength(1);
  });

  it("ensureCustomerForBuyer: phone AMBIGUOUS (2 owners) → ConflictError, no third duplicate", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "a@x.az", phone: "0507000000", phoneCanonical: "+994507000000" },
      { id: "c2", code: "CUS-2", email: "b@x.az", phone: "+994507000000", phoneCanonical: "+994507000000" },
    ];
    const { service, prisma } = makeCrmService(customers);
    await expect(
      service.ensureCustomerForBuyer(prisma, { email: "third@x.az", phone: "0507000000" }),
    ).rejects.toThrow(ConflictError);
    expect(customers).toHaveLength(2); // no auto-merge, no third duplicate
  });

  it("ensureCustomerForBuyer: email found, phone owned by ANOTHER customer → ConflictError", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "buyer@x.az", phone: "+994501111111", phoneCanonical: "+994501111111" },
      { id: "c2", code: "CUS-2", email: "other@x.az", phone: "+994502222222", phoneCanonical: "+994502222222" },
    ];
    const { service, prisma } = makeCrmService(customers);
    await expect(
      service.ensureCustomerForBuyer(prisma, { email: "buyer@x.az", phone: "+994502222222" }),
    ).rejects.toThrow(ConflictError);
    expect(customers).toHaveLength(2);
  });

  it("ensureCustomerForBuyer email-reuse: same phone as email-owner → reuse (no conflict)", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "buyer@x.az", phone: "050 111 11 11", phoneCanonical: "+994501111111" },
    ];
    const { service, prisma } = makeCrmService(customers);
    const result = await service.ensureCustomerForBuyer(prisma, {
      email: "buyer@x.az",
      phone: "+994501111111",
    });
    expect(result).toEqual({ customerId: "c1", created: false });
    expect(customers).toHaveLength(1);
  });

  it("ensureCustomerForBuyer: legacy row without phoneCanonical matches (fallback)", async () => {
    const customers: CustomerRow[] = [
      { id: "c1", code: "CUS-1", email: "legacy@x.az", phone: "050 111 11 11", phoneCanonical: null },
    ];
    const { service, prisma } = makeCrmService(customers);
    const result = await service.ensureCustomerForBuyer(prisma, {
      email: "new@x.az",
      phone: "+994501111111",
    });
    expect(result).toEqual({ customerId: "c1", created: false });
    expect(customers).toHaveLength(1);
  });
});
