import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { loadWhatsAppConfig, type WhatsAppConfig } from "../whatsapp.config";
import { WhatsAppSessionLeaseService, type LeaseHandle } from "../lease/session-lease.service";
import { WhatsAppSessionRegistryService } from "./session-registry.service";
import { MockWhatsAppProvider } from "../provider/mock/mock-whatsapp.provider";
import type {
  WhatsAppConnectionSnapshot,
  WhatsAppDeliveryUpdate,
  WhatsAppInboundProviderMessage,
} from "../provider/whatsapp-provider";
import { NotFoundError, ConflictError, DomainError } from "../../../shared/errors";

/**
 * M5: реестр сессий — per-account контексты (провайдер+ownership+sessionPath),
 * аккаунт-строки, event-хабы, legacy-прокси и одноразовый переезд
 * `auth-state.enc` → `<accountId>/auth-state.enc`.
 */

type Row = Record<string, unknown>;

function accountRow(overrides: Row = {}): Row {
  const now = new Date("2026-10-01T00:00:00Z");
  return {
    id: "acc-1",
    provider: "mock",
    state: "DISCONNECTED",
    label: null,
    phone: null,
    connectedAt: null,
    lastDisconnectedAt: null,
    lastError: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fakePrisma(seed: Row[] = []) {
  const rows = seed.map((r) => ({ ...r }));
  let seq = 0;
  const matches = (row: Row, where?: Row): boolean => {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        if (row[key] !== null && row[key] !== undefined) return false;
        continue;
      }
      if (row[key] !== value) return false;
    }
    return true;
  };
  const pick = (row: Row, select?: Record<string, boolean>): Row => {
    if (!select) return { ...row };
    const out: Row = {};
    for (const [key, include] of Object.entries(select)) if (include) out[key] = row[key];
    return out;
  };
  const sort = (list: Row[], orderBy?: Record<string, string>): Row[] => {
    if (orderBy?.["createdAt"] === "asc") {
      return [...list].sort(
        (a, b) => (a["createdAt"] as Date).getTime() - (b["createdAt"] as Date).getTime(),
      );
    }
    return list;
  };
  const leaseRows: Row[] = [];
  return {
    rows,
    leaseRows,
    whatsAppSessionLease: {
      findUnique: async ({ where }: { where: Row }) => {
        const row = leaseRows.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of leaseRows) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      },
      delete: async ({ where }: { where: Row }) => {
        const index = leaseRows.findIndex((r) => matches(r, where));
        if (index < 0) throw new Error("lease row not found");
        return leaseRows.splice(index, 1)[0];
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = leaseRows.find((r) => matches(r, where));
        if (!row) throw new Error("lease row not found");
        Object.assign(row, data);
        return { ...row };
      },
    },
    whatsAppAccount: {
      findMany: async (args: { where?: Row; orderBy?: Record<string, string> } = {}) =>
        sort(rows.filter((r) => matches(r, args.where)), args.orderBy).map((r) => ({ ...r })),
      findUnique: async ({ where }: { where: Row }) => {
        const row = rows.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },
      findFirst: async (
        args: { where?: Row; orderBy?: Record<string, string>; select?: Record<string, boolean> } = {},
      ) => {
        const row = sort(rows.filter((r) => matches(r, args.where)), args.orderBy)[0];
        return row ? pick(row, args.select) : null;
      },
      create: async ({ data, select }: { data: Row; select?: Record<string, boolean> }) => {
        const now = new Date();
        const row: Row = {
          id: `acc-${++seq}`,
          provider: "mock",
          state: "DISCONNECTED",
          label: null,
          phone: null,
          connectedAt: null,
          lastDisconnectedAt: null,
          lastError: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        rows.push(row);
        return pick(row, select);
      },
    },
  };
}

type AnyFn = (...args: never[]) => Promise<unknown>;

function fakeLease() {
  const handle = (token = 1): LeaseHandle => ({
    instanceId: "host:1:test",
    fencingToken: token,
    expiresAt: new Date(Date.now() + 45_000),
  });
  const lease = {
    instanceId: "host:1:test",
    acquire: jest.fn<AnyFn>(),
    renew: jest.fn<AnyFn>(),
    release: jest.fn<AnyFn>(),
    getOwner: jest.fn<AnyFn>(),
    assertOwnership: jest.fn<AnyFn>(),
  };
  lease.acquire.mockResolvedValue(handle(1));
  lease.renew.mockResolvedValue(handle(1));
  lease.release.mockResolvedValue(undefined);
  lease.assertOwnership.mockResolvedValue(undefined);
  return lease;
}

const tmpDirs: string[] = [];
async function tmpDir(): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "wa-registry-spec-"));
  tmpDirs.push(dir);
  return dir;
}

function mockConfig(sessionPath: string): WhatsAppConfig {
  return loadWhatsAppConfig({
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PROVIDER: "mock",
    WHATSAPP_SESSION_PATH: sessionPath,
  });
}

function baileysConfig(sessionPath: string): WhatsAppConfig {
  return loadWhatsAppConfig({
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PROVIDER: "baileys",
    WHATSAPP_SESSION_PATH: sessionPath,
    WHATSAPP_AUTH_ENCRYPTION_KEY: "test-encryption-key-for-registry-spec",
  });
}

const registries: WhatsAppSessionRegistryService[] = [];
function makeRegistry(options: { rows?: Row[]; config?: WhatsAppConfig } = {}) {
  const prisma = fakePrisma(options.rows ?? []);
  const lease = fakeLease();
  const config = options.config ?? mockConfig(path.join(os.tmpdir(), "wa-registry-unused"));
  const registry = new WhatsAppSessionRegistryService(
    prisma as never,
    lease as unknown as WhatsAppSessionLeaseService,
    config,
  );
  registries.push(registry);
  return { registry, prisma, lease, config };
}

afterEach(async () => {
  for (const registry of registries.splice(0)) {
    await registry.dispose().catch(() => undefined);
  }
  for (const dir of tmpDirs.splice(0)) {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe("WhatsAppSessionRegistryService (M5): аккаунт-строки", () => {
  it("createAccount: label тримится, пустой → null; provider из конфига; state DISCONNECTED", async () => {
    const { registry } = makeRegistry();

    const named = await registry.createAccount("  Sales line  ");
    expect(named).toMatchObject({ label: "Sales line", provider: "mock", state: "DISCONNECTED" });
    expect(named.archivedAt).toBeNull();

    const empty = await registry.createAccount("   ");
    expect(empty.label).toBeNull();
    const none = await registry.createAccount();
    expect(none.label).toBeNull();
  });

  it("listAccounts включает архивные; listActiveAccounts — нет (порядок по createdAt)", async () => {
    const { registry } = makeRegistry({
      rows: [
        accountRow({ id: "a", createdAt: new Date("2026-10-01") }),
        accountRow({ id: "b", createdAt: new Date("2026-10-02"), archivedAt: new Date("2026-10-03") }),
        accountRow({ id: "c", createdAt: new Date("2026-10-04") }),
      ],
    });

    expect((await registry.listAccounts()).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect((await registry.listActiveAccounts()).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("ensurePrimaryAccountId: первый активный по createdAt; без активных — создаёт новую строку", async () => {
    const { registry } = makeRegistry({
      rows: [
        accountRow({ id: "archived", createdAt: new Date("2026-10-01"), archivedAt: new Date() }),
        accountRow({ id: "second", createdAt: new Date("2026-10-03") }),
        accountRow({ id: "first", createdAt: new Date("2026-10-02") }),
      ],
    });
    expect(await registry.ensurePrimaryAccountId()).toBe("first");

    const { registry: empty, prisma: emptyPrisma } = makeRegistry();
    const created = await empty.ensurePrimaryAccountId();
    expect(emptyPrisma.rows).toHaveLength(1);
    expect(created).toBe(emptyPrisma.rows[0]["id"]);
    expect(await empty.ensurePrimaryAccountId()).toBe(created); // идемпотентно
    expect(emptyPrisma.rows).toHaveLength(1);
  });
});

describe("WhatsAppSessionRegistryService (M5): контексты", () => {
  it("ensureContext: неизвестный номер → 404; архивный → 409; фича выключена → 503", async () => {
    const { registry } = makeRegistry({
      rows: [accountRow({ id: "archived-1", archivedAt: new Date() })],
    });

    await expect(registry.ensureContext("missing")).rejects.toThrow(NotFoundError);
    await expect(registry.ensureContext("archived-1")).rejects.toThrow(ConflictError);

    const { registry: disabled } = makeRegistry({
      config: loadWhatsAppConfig({ WHATSAPP_ENABLED: "false" }),
      rows: [accountRow({ id: "acc-1" })],
    });
    await expect(disabled.ensureContext("acc-1")).rejects.toThrow(DomainError);
    await expect(disabled.ensureContext("acc-1")).rejects.toMatchObject({ httpStatus: 503 });
    expect(disabled.provideLegacyProvider()).toBeNull();
  });

  it("ensureContext: per-account sessionPath и свой ключ аренды whatsapp:<accountId>", async () => {
    const sessionPath = await tmpDir();
    const { registry, lease } = makeRegistry({
      rows: [accountRow({ id: "acc-9" }), accountRow({ id: "acc-8", createdAt: new Date("2026-10-02") })],
      config: mockConfig(sessionPath),
    });

    const ctxA = await registry.ensureContext("acc-9");
    const ctxB = await registry.ensureContext("acc-8");

    expect(ctxA.sessionPath).toBe(path.join(sessionPath, "acc-9"));
    expect(ctxB.sessionPath).toBe(path.join(sessionPath, "acc-8"));
    expect(registry.sessionPathFor("acc-9")).toBe(path.join(sessionPath, "acc-9"));
    expect(ctxA.provider).toBeInstanceOf(MockWhatsAppProvider);
    expect(ctxA.provider).not.toBe(ctxB.provider);

    await ctxA.ownership.ensureOwnership();
    expect(lease.acquire).toHaveBeenCalledWith("whatsapp:acc-9");
    await ctxB.ownership.ensureOwnership();
    expect(lease.acquire).toHaveBeenLastCalledWith("whatsapp:acc-8");
    await ctxA.ownership.release();
    await ctxB.ownership.release();
  });

  it("removeContext: останавливает провайдер, снимает контекст, идемпотентно", async () => {
    const { registry } = makeRegistry({ rows: [accountRow({ id: "acc-1" })] });
    const ctx = await registry.ensureContext("acc-1");
    const stop = jest.spyOn(ctx.provider, "stop");

    await registry.removeContext("acc-1", "archived");
    expect(stop).toHaveBeenCalledWith("archived");
    expect(registry.get("acc-1")).toBeUndefined();

    await registry.removeContext("acc-1", "archived"); // no-op
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("WhatsAppSessionRegistryService (M5): event-хабы", () => {
  it("inbound/state/delivery события несут accountId провайдера-источника", async () => {
    const { registry } = makeRegistry({ rows: [accountRow({ id: "acc-1" })] });
    const ctx = await registry.ensureContext("acc-1");
    const provider = ctx.provider as MockWhatsAppProvider;

    const inbound: Array<[string, WhatsAppInboundProviderMessage]> = [];
    const states: Array<[string, WhatsAppConnectionSnapshot]> = [];
    const delivery: Array<[string, WhatsAppDeliveryUpdate]> = [];
    registry.onInbound((accountId, message) => inbound.push([accountId, message]));
    registry.onStateChange((accountId, snapshot) => states.push([accountId, snapshot]));
    registry.onDeliveryUpdate((accountId, update) => delivery.push([accountId, update]));

    provider.driveInbound({ text: "hi from acc-1" });
    provider.driveState("INITIALIZING");
    provider.driveState("CONNECTING");
    provider.driveState("CONNECTED");
    provider.driveDelivery({ providerMessageId: "3EB0X", status: "delivered" });

    expect(inbound).toHaveLength(1);
    expect(inbound[0][0]).toBe("acc-1");
    expect(inbound[0][1].text).toBe("hi from acc-1");
    expect(states.at(-1)).toEqual(["acc-1", expect.objectContaining({ state: "CONNECTED" })]);
    expect(delivery[0]).toEqual([
      "acc-1",
      expect.objectContaining({ providerMessageId: "3EB0X", status: "delivered" }),
    ]);
  });

  it("потеря аренды (self-fencing) доходит до hub'а onLost с accountId", async () => {
    const { registry, lease } = makeRegistry({ rows: [accountRow({ id: "acc-1" })] });
    const ctx = await registry.ensureContext("acc-1");

    const lost: Array<[string, string]> = [];
    registry.onLost((accountId, reason) => lost.push([accountId, reason]));

    await ctx.ownership.ensureOwnership(); // acquire
    lease.assertOwnership.mockRejectedValueOnce(new Error("lease stolen"));
    await ctx.ownership.ensureOwnership(); // assertOwnership падает → markLost → re-acquire

    expect(lost).toEqual([["acc-1", "ownership assertion failed"]]);
    await ctx.ownership.release();
  });
});

describe("WhatsAppSessionRegistryService (M5): legacy WHATSAPP_PROVIDER-прокси", () => {
  it("прокси стабилен, instanceof работает, подписки переживают появление настоящего контекста", async () => {
    const { registry } = makeRegistry();
    const proxy = registry.provideLegacyProvider()!;

    // Placeholder создаётся синхронно (фабрика модуля — без БД).
    expect(registry.get("__legacy__")?.placeholder).toBe(true);
    expect(registry.provideLegacyProvider()).toBe(proxy);
    expect(proxy).toBeInstanceOf(MockWhatsAppProvider);

    const messages: string[] = [];
    const snapshots: string[] = [];
    const unsubs = [
      proxy.onInbound((m: WhatsAppInboundProviderMessage) => messages.push(m.text ?? "")),
      proxy.onStateChange((s: WhatsAppConnectionSnapshot) => snapshots.push(s.state)),
    ];

    // До настоящих контекстов события идут от placeholder-провайдера.
    (registry.get("__legacy__")!.provider as MockWhatsAppProvider).driveInbound({ text: "from-placeholder" });
    expect(messages).toEqual(["from-placeholder"]);

    // Появился настоящий номер: подписки живы, события уже от него.
    const prisma = (registry as unknown as { prisma: ReturnType<typeof fakePrisma> }).prisma;
    prisma.rows.push(accountRow({ id: "acc-real" }));
    const ctx = await registry.ensureContext("acc-real");
    (ctx.provider as MockWhatsAppProvider).driveInbound({ text: "from-real" });
    (ctx.provider as MockWhatsAppProvider).driveState("INITIALIZING");
    (ctx.provider as MockWhatsAppProvider).driveState("CONNECTING");
    (ctx.provider as MockWhatsAppProvider).driveState("CONNECTED");

    expect(messages).toEqual(["from-placeholder", "from-real"]);
    expect(snapshots.at(-1)).toBe("CONNECTED");
    // Forwards идут на primary (настоящий контекст), а не на placeholder.
    expect(proxy.getSnapshot()).toMatchObject({ state: "CONNECTED" });
    expect(proxy).toBeInstanceOf(MockWhatsAppProvider);

    for (const unsub of unsubs) unsub();
  });

  it("disabled → null (kill-switch)", () => {
    const { registry } = makeRegistry({ config: loadWhatsAppConfig({ WHATSAPP_ENABLED: "false" }) });
    expect(registry.provideLegacyProvider()).toBeNull();
  });
});

describe("WhatsAppSessionRegistryService (M5): bootstrap и миграция auth-файла", () => {
  it("bootstrap строит контексты активных номеров и снимает placeholder", async () => {
    const sessionPath = await tmpDir();
    const { registry } = makeRegistry({
      rows: [
        accountRow({ id: "acc-1" }),
        accountRow({ id: "acc-arch", archivedAt: new Date() }),
      ],
      config: mockConfig(sessionPath),
    });

    const created: string[] = [];
    registry.provideLegacyProvider(); // placeholder до бутстрапа
    registry.onContextCreated((ctx) => created.push(ctx.accountId));

    registry.onApplicationBootstrap();
    await registry.ready();

    expect(created).toEqual(["acc-1"]); // архивный номер контекста не имеет
    expect(registry.get("acc-arch")).toBeUndefined();
    expect(registry.get("__legacy__")).toBeUndefined();
    expect(registry.get("acc-1")?.placeholder).toBe(false);
    expect(registry.get("acc-1")?.sessionPath).toBe(path.join(sessionPath, "acc-1"));
  });

  it("baileys: одноразовый переезд legacy auth-state.enc → <primaryId>/auth-state.enc", async () => {
    const sessionPath = await tmpDir();
    await fsp.writeFile(path.join(sessionPath, "auth-state.enc"), "encrypted-blob", "utf8");

    const { registry, prisma } = makeRegistry({ config: baileysConfig(sessionPath) });
    registry.onApplicationBootstrap();
    await registry.ready();

    const primaryId = String(prisma.rows[0]["id"]); // ensurePrimaryAccountId создал строку
    await expect(fsp.readFile(path.join(sessionPath, primaryId, "auth-state.enc"), "utf8")).resolves.toBe(
      "encrypted-blob",
    );
    await expect(fsp.access(path.join(sessionPath, "auth-state.enc"))).rejects.toThrow();
  });

  it("baileys: уже мигрированный файл не трогается (legacy остаётся)", async () => {
    const sessionPath = await tmpDir();
    await fsp.writeFile(path.join(sessionPath, "auth-state.enc"), "legacy-copy", "utf8");
    await fsp.mkdir(path.join(sessionPath, "acc-1"), { recursive: true });
    await fsp.writeFile(path.join(sessionPath, "acc-1", "auth-state.enc"), "target-copy", "utf8");

    const { registry } = makeRegistry({
      rows: [accountRow({ id: "acc-1" })],
      config: baileysConfig(sessionPath),
    });
    registry.onApplicationBootstrap();
    await registry.ready();

    await expect(fsp.readFile(path.join(sessionPath, "acc-1", "auth-state.enc"), "utf8")).resolves.toBe(
      "target-copy",
    );
    await expect(fsp.readFile(path.join(sessionPath, "auth-state.enc"), "utf8")).resolves.toBe("legacy-copy");
  });

  it("legacy lease-row «whatsapp» переносится на primary с сохранением fencingToken", async () => {
    const { registry, prisma } = makeRegistry({
      rows: [
        accountRow({ id: "acc-1", createdAt: new Date("2026-10-01") }),
        accountRow({ id: "acc-2", createdAt: new Date("2026-10-02") }),
      ],
    });
    prisma.leaseRows.push({ key: "whatsapp", fencingToken: 13, instanceId: "old:1:x" });

    const primaryId = await registry.ensurePrimaryAccountId();

    expect(primaryId).toBe("acc-1");
    expect(prisma.leaseRows).toHaveLength(1);
    expect(prisma.leaseRows[0]).toMatchObject({ key: "whatsapp:acc-1", fencingToken: 13 });
  });

  it("легаси-строка переносится и при создании primary (до первого acquire)", async () => {
    const { registry, prisma } = makeRegistry();
    prisma.leaseRows.push({ key: "whatsapp", fencingToken: 7, instanceId: "old:1:x" });

    const primaryId = await registry.ensurePrimaryAccountId();

    expect(prisma.leaseRows[0]).toMatchObject({ key: `whatsapp:${primaryId}`, fencingToken: 7 });
  });

  it("целевая строка уже существует — токены сливаются (MAX), легаси удаляется", async () => {
    const { registry, prisma } = makeRegistry({ rows: [accountRow({ id: "acc-1" })] });
    prisma.leaseRows.push(
      { key: "whatsapp", fencingToken: 13, instanceId: "old:1:x" },
      { key: "whatsapp:acc-1", fencingToken: 2, instanceId: "new:1:x" },
    );

    await registry.ensurePrimaryAccountId();

    expect(prisma.leaseRows).toHaveLength(1);
    expect(prisma.leaseRows[0]).toMatchObject({ key: "whatsapp:acc-1", fencingToken: 13 });
  });

  it("целевая строка с бо́льшим токеном — легаси удаляется без перезаписи", async () => {
    const { registry, prisma } = makeRegistry({ rows: [accountRow({ id: "acc-1" })] });
    prisma.leaseRows.push(
      { key: "whatsapp", fencingToken: 13, instanceId: "old:1:x" },
      { key: "whatsapp:acc-1", fencingToken: 20, instanceId: "new:1:x" },
    );

    await registry.ensurePrimaryAccountId();

    expect(prisma.leaseRows).toHaveLength(1);
    expect(prisma.leaseRows[0]).toMatchObject({ key: "whatsapp:acc-1", fencingToken: 20 });
  });

  it("bootstrap переносит легаси-строку до построения контекстов; без номеров — не трогает", async () => {
    const sessionPath = await tmpDir();
    const { registry, prisma } = makeRegistry({
      rows: [accountRow({ id: "acc-1" })],
      config: mockConfig(sessionPath),
    });
    prisma.leaseRows.push({ key: "whatsapp", fencingToken: 13, instanceId: "old:1:x" });

    registry.onApplicationBootstrap();
    await registry.ready();

    expect(prisma.leaseRows[0]).toMatchObject({ key: "whatsapp:acc-1", fencingToken: 13 });

    // Без активных номеров строка остаётся до появления primary.
    const empty = makeRegistry({ config: mockConfig(await tmpDir()) });
    empty.prisma.leaseRows.push({ key: "whatsapp", fencingToken: 5, instanceId: "old:1:x" });
    empty.registry.onApplicationBootstrap();
    await empty.registry.ready();
    expect(empty.prisma.leaseRows[0]).toMatchObject({ key: "whatsapp", fencingToken: 5 });
  });
});
