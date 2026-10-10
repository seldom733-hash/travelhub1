import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { WhatsAppSessionRuntimeService } from "./session-runtime.service";
import { loadWhatsAppConfig, type WhatsAppConfig } from "../whatsapp.config";
import { MockWhatsAppProvider } from "../provider/mock/mock-whatsapp.provider";
import { WhatsAppSessionOwnershipService } from "../ownership/session-ownership.service";
import type { WhatsAppSessionRegistryService, WhatsAppSessionContext } from "./session-registry.service";
import type {
  WhatsAppConnectionSnapshot,
} from "../provider/whatsapp-provider";
import { ConflictError, DomainError, ValidationDomainError } from "../../../shared/errors";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";

const ACTOR = { id: "user-1", username: "operator" };
const HANDLE = { instanceId: "host:1:abc", fencingToken: 7, expiresAt: new Date(Date.now() + 45_000), renewedAt: new Date() };

interface AccountRow {
  id: string;
  provider: string;
  state: string;
  label: string | null;
  phone: string | null;
  connectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastError: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeConfig(overrides: Record<string, string> = {}): WhatsAppConfig {
  return loadWhatsAppConfig({
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PROVIDER: "mock",
    WHATSAPP_SESSION_PATH: join(mkdtempSync(join(tmpdir(), "wa-runtime-")), "session"),
    WHATSAPP_AUTH_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    WHATSAPP_AUTO_CONNECT: "false",
    ...overrides,
  });
}

function makePrisma() {
  const row: Partial<AccountRow> = { id: "acc-1" };
  return {
    whatsAppAccount: {
      findFirst: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      create: jest.fn<() => Promise<unknown>>().mockResolvedValue({ id: "acc-1", state: "DISCONNECTED" }),
      update: jest.fn<(args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>>(
        async (args) => ({ ...row, ...args.data }),
      ),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  } as unknown as PrismaService;
}

function makeOwnership() {
  return {
    ensureOwnership: jest.fn(async () => HANDLE),
    assertActive: jest.fn(async () => HANDLE),
    onLost: jest.fn(() => () => {}),
    current: { ...HANDLE },
  } as unknown as WhatsAppSessionOwnershipService;
}

function makeSecurity() {
  return { audit: jest.fn(async () => ({})) } as unknown as SecurityService;
}

function accountRow(overrides: Partial<AccountRow> = {}): AccountRow {
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/**
 * Фейк реестра: один контекст (provider+ownership+sessionPath), события
 * провайдера форвардятся в hub'ы — как в настоящем WhatsAppSessionRegistryService.
 */
function makeRegistry(options: {
  provider?: MockWhatsAppProvider | null;
  ownership?: ReturnType<typeof makeOwnership>;
  rows?: AccountRow[];
  sessionPath?: string;
}) {
  const rows = options.rows ?? [];
  const ownership = options.ownership ?? makeOwnership();
  const sessionPath = options.sessionPath ?? join(mkdtempSync(join(tmpdir(), "wa-registry-")), "acc-1");
  const stateListeners: Array<(accountId: string, snapshot: WhatsAppConnectionSnapshot) => void> = [];
  const lostListeners: Array<(accountId: string, reason: string) => void> = [];
  const contexts = new Map<string, WhatsAppSessionContext>();

  if (options.provider) {
    const ctx: WhatsAppSessionContext = {
      accountId: "acc-1",
      provider: options.provider,
      ownership,
      sessionPath,
      placeholder: false,
    };
    contexts.set("acc-1", ctx);
    // Проводка provider → hub (как buildContext в реестре).
    options.provider.onStateChange((snapshot) => {
      for (const listener of [...stateListeners]) listener("acc-1", snapshot);
    });
  }

  const registry = {
    enabled: true,
    get: (accountId: string) => contexts.get(accountId),
    async ensureContext(accountId: string) {
      const ctx = contexts.get(accountId);
      if (!ctx) throw new Error(`no context for ${accountId}`);
      return ctx;
    },
    async ensurePrimaryAccountId(): Promise<string> {
      return rows[0]?.id ?? "acc-1";
    },
    async getAccount(accountId: string): Promise<AccountRow | null> {
      return rows.find((row) => row.id === accountId) ?? null;
    },
    async listActiveAccounts(): Promise<AccountRow[]> {
      return rows.filter((row) => !row.archivedAt);
    },
    async ready(): Promise<void> {},
    async removeContext(accountId: string): Promise<void> {
      contexts.delete(accountId);
    },
    onStateChange(listener: (accountId: string, snapshot: WhatsAppConnectionSnapshot) => void) {
      stateListeners.push(listener);
      return () => {
        const index = stateListeners.indexOf(listener);
        if (index >= 0) stateListeners.splice(index, 1);
      };
    },
    onLost(listener: (accountId: string, reason: string) => void) {
      lostListeners.push(listener);
      return () => {
        const index = lostListeners.indexOf(listener);
        if (index >= 0) lostListeners.splice(index, 1);
      };
    },
    // Тестовые триггеры (аналог событий настоящего реестра).
    fireLost(accountId: string, reason: string) {
      for (const listener of [...lostListeners]) listener(accountId, reason);
    },
    _contexts: contexts,
    _ownership: ownership,
  };
  return registry as unknown as WhatsAppSessionRegistryService & typeof registry;
}

describe("WhatsAppSessionRuntimeService (M2, §6.2/§6.4; M5 multi-number)", () => {
  let sessionPath: string;

  beforeEach(() => {
    sessionPath = mkdtempSync(join(tmpdir(), "wa-runtime-db-"));
  });

  afterEach(() => {
    rmSync(sessionPath, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function runtime(
    prisma: PrismaService,
    security: SecurityService,
    config: WhatsAppConfig,
    registry: WhatsAppSessionRegistryService,
  ): WhatsAppSessionRuntimeService {
    return new WhatsAppSessionRuntimeService(prisma, security, config, registry);
  }

  it("getStatus: фича выключена → enabled=false, state DISCONNECTED, без падений", async () => {
    const config = loadWhatsAppConfig({});
    const service = runtime(makePrisma(), makeSecurity(), config, makeRegistry({}));
    const status = await service.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.provider).toBe("baileys");
    expect(status.state).toBe("DISCONNECTED");
    expect(status.hasQr).toBe(false);
    expect(status.instanceId).toBeNull();
  });

  it("getStatus: live-снимок провайдера приоритетнее строки БД; явный accountId → его контекст", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const registry = makeRegistry({
      provider,
      rows: [accountRow({ id: "acc-1" }), accountRow({ id: "acc-2", state: "QR_REQUIRED" })],
    });
    const service = runtime(makePrisma(), makeSecurity(), makeConfig(), registry);
    const status = await service.getStatus();
    expect(status.state).toBe("CONNECTED");
    expect(status.instanceId).toBe("mock-1");
    expect(status.enabled).toBe(true);
    expect(status.reconnect.maxAttempts).toBeGreaterThan(0);
    // Второй номер без контекста → state из строки БД.
    const other = await service.getStatus("acc-2");
    expect(other.state).toBe("QR_REQUIRED");
    expect(other.instanceId).toBeNull();
    await provider.stop("test");
  });

  it("getQr: только state=QR_REQUIRED; иначе ConflictError; выключено → 503", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "qr" });
    await provider.start();
    const registry = makeRegistry({ provider, rows: [accountRow()] });
    const service = runtime(makePrisma(), makeSecurity(), makeConfig(), registry);
    expect(await service.getQr()).toMatch(/^mock-qr-/);
    provider.driveState("CONNECTING");
    provider.driveState("CONNECTED");
    await expect(service.getQr()).rejects.toBeInstanceOf(ConflictError);

    const disabled = runtime(makePrisma(), makeSecurity(), loadWhatsAppConfig({}), makeRegistry({}));
    try {
      await disabled.getQr();
      throw new Error("expected DomainError");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).httpStatus).toBe(503);
    }
    await provider.stop("test");
  });

  it("connect: confirm=false → 422; confirm=true → ensureOwnership ДО start + audit whatsapp.connected", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    const ownership = makeOwnership();
    const security = makeSecurity();
    const prisma = makePrisma();
    const registry = makeRegistry({ provider, ownership, rows: [accountRow()] });
    const service = runtime(
      prisma,
      security,
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      registry,
    );

    await expect(service.connect(ACTOR, false)).rejects.toBeInstanceOf(ValidationDomainError);
    expect(ownership.ensureOwnership).not.toHaveBeenCalled();

    const order: string[] = [];
    (ownership.ensureOwnership as jest.Mock).mockImplementation(async () => {
      order.push("ownership");
      return HANDLE;
    });
    const originalStart = provider.start.bind(provider);
    provider.start = async () => {
      order.push("start");
      await originalStart();
    };

    const status = await service.connect(ACTOR, true);
    expect(order).toEqual(["ownership", "start"]);
    expect(status.state).toBe("CONNECTED");
    expect(security.audit).toHaveBeenCalledTimes(1);
    const auditArgs = (security.audit as jest.Mock).mock.calls[0] as unknown as [
      unknown,
      { action: string; userId: string; resourceId: string | null; details: Record<string, unknown> },
    ];
    expect(auditArgs[1].action).toBe("whatsapp.connected");
    expect(auditArgs[1].userId).toBe("user-1");
    expect(auditArgs[1].resourceId).toBe("acc-1");
    expect(auditArgs[1].details["fencingToken"]).toBe(7);
    await provider.stop("test");
  });

  it("connect/disconnect/logout/session-reset/archive: выключено → 503", async () => {
    const service = runtime(makePrisma(), makeSecurity(), loadWhatsAppConfig({}), makeRegistry({}));
    for (const call of [
      () => service.connect(ACTOR, true),
      () => service.disconnect(ACTOR),
      () => service.logout(ACTOR, true),
      () => service.sessionReset(ACTOR, true),
      () => service.archive(ACTOR, true, "acc-1"),
    ]) {
      await expect(call()).rejects.toMatchObject({ httpStatus: 503 });
    }
  });

  it("disconnect: assertActive ДО stop + audit whatsapp.disconnected", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const ownership = makeOwnership();
    const security = makeSecurity();
    const registry = makeRegistry({ provider, ownership, rows: [accountRow()] });
    const service = runtime(makePrisma(), security, makeConfig(), registry);

    const order: string[] = [];
    (ownership.assertActive as jest.Mock).mockImplementation(async () => {
      order.push("assertActive");
      return HANDLE;
    });
    const originalStop = provider.stop.bind(provider);
    provider.stop = async (reason?: string) => {
      order.push("stop");
      await originalStop(reason);
    };

    const status = await service.disconnect(ACTOR);
    expect(order).toEqual(["assertActive", "stop"]);
    expect(status.state).toBe("DISCONNECTED");
    expect((security.audit as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      action: "whatsapp.disconnected",
      userId: "user-1",
    });
  });

  it("logout: confirm обязателен; audit whatsapp.logout", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const security = makeSecurity();
    const registry = makeRegistry({ provider, rows: [accountRow()] });
    const service = runtime(makePrisma(), security, makeConfig(), registry);

    await expect(service.logout(ACTOR, false)).rejects.toBeInstanceOf(ValidationDomainError);
    await service.logout(ACTOR, true);
    expect((security.audit as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      action: "whatsapp.logout",
      details: { fencingToken: 7 },
    });
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
  });

  it("session-reset: confirm обязателен; wipe ЛОКАЛЬНОГО auth-state НОМЕРА + audit", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const security = makeSecurity();
    const ctxPath = join(sessionPath, "acc-1");
    mkdirSync(ctxPath, { recursive: true });
    const registry = makeRegistry({ provider, rows: [accountRow()], sessionPath: ctxPath });
    const service = runtime(makePrisma(), security, makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }), registry);

    await expect(service.sessionReset(ACTOR, false)).rejects.toBeInstanceOf(ValidationDomainError);
    await service.sessionReset(ACTOR, true);
    expect((security.audit as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      action: "whatsapp.session_reset",
      details: { wipedLocalSession: true },
    });
    await provider.stop("test");
  });

  it("M5 archive: confirm обязателен; stop → wipe → removeContext → archivedAt + audit", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const ownership = makeOwnership();
    const security = makeSecurity();
    const prisma = makePrisma();
    const ctxPath = join(sessionPath, "acc-1");
    mkdirSync(ctxPath, { recursive: true });
    const rows = [accountRow()];
    const registry = makeRegistry({ provider, ownership, rows, sessionPath: ctxPath });
    const service = runtime(
      prisma,
      security,
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      registry,
    );

    await expect(service.archive(ACTOR, false, "acc-1")).rejects.toBeInstanceOf(ValidationDomainError);
    const status = await service.archive(ACTOR, true, "acc-1");
    expect(status.enabled).toBe(true);
    expect(ownership.ensureOwnership).toHaveBeenCalled();
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
    // Контекст снят из реестра.
    expect(registry.get("acc-1")).toBeUndefined();
    // archivedAt записан, строка НЕ удалена (история сохраняется).
    const updateArgs = (prisma.whatsAppAccount.update as jest.Mock).mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateArgs.where.id).toBe("acc-1");
    expect(updateArgs.data["archivedAt"]).toBeInstanceOf(Date);
    expect((security.audit as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      action: "whatsapp.archived",
      resourceId: "acc-1",
    });
    // Имитация записи в БД → повторная архивация идемпотентна.
    rows[0]!.archivedAt = updateArgs.data["archivedAt"] as Date;
    const again = await service.archive(ACTOR, true, "acc-1");
    expect(again.enabled).toBe(true);
  });

  it("autoConnect=false → bootstrap не дёргает start; state-change персистится в WhatsAppAccount", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    const prisma = makePrisma();
    const registry = makeRegistry({ provider, rows: [accountRow()] });
    const service = runtime(prisma, makeSecurity(), makeConfig(), registry);
    service.onApplicationBootstrap();
    // Провайдер ещё не запущен — bootstrap не трогает его.
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");

    await provider.start();
    const updateMock = prisma.whatsAppAccount.update as unknown as {
      mock: { calls: Array<[{ data: { state: string } }]> };
    };
    const readStates = (): string[] => updateMock.mock.calls.map((call) => call[0].data.state);
    const deadline = Date.now() + 2000;
    let states: string[] = [];
    while (Date.now() < deadline) {
      states = readStates();
      if (states[states.length - 1] === "CONNECTED") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(states[states.length - 1]).toBe("CONNECTED");
    expect(states).toContain("CONNECTED");

    await service.onApplicationShutdown();
    await provider.stop("test");
  });

  it("autoConnect bootstrap: системный актор аудируется с userId=null (без FK AuditLog)", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    const security = makeSecurity();
    const registry = makeRegistry({ provider, rows: [accountRow()] });
    const service = runtime(
      makePrisma(),
      security,
      makeConfig({ WHATSAPP_AUTO_CONNECT: "true" }),
      registry,
    );
    service.onApplicationBootstrap();
    const auditMock = security.audit as unknown as { mock: { calls: unknown[][] } };
    const deadline = Date.now() + 2000;
    while (auditMock.mock.calls.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(auditMock.mock.calls.length).toBeGreaterThan(0);
    const entry = auditMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(entry["action"]).toBe("whatsapp.connected");
    expect(entry["userId"]).toBeNull();
    expect(entry["username"]).toBe("system");
    await service.onApplicationShutdown();
    await provider.stop("test");
  });

  it("потеря lease: registry.onLost → provider.stop НОМЕРА + строка Account в ERROR", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const prisma = makePrisma();
    const registry = makeRegistry({ provider, rows: [accountRow()] });
    const service = runtime(prisma, makeSecurity(), makeConfig(), registry);
    service.onApplicationBootstrap();

    registry.fireLost("acc-1", "lease lost: not_owner");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
    const updates = (prisma.whatsAppAccount.updateMany as jest.Mock).mock.calls as Array<
      [{ where: { id: string }; data: { state: string; lastError: string | null } }]
    >;
    const last = updates[updates.length - 1]?.[0];
    expect(last?.where.id).toBe("acc-1");
    expect(last?.data.state).toBe("ERROR");
    expect(last?.data.lastError).toContain("lease lost");

    await service.onApplicationShutdown();
    await provider.stop("test");
  });

  it("M5: потеря lease одного номера НЕ гасит остальные (hub с accountId)", async () => {
    const providerA = new MockWhatsAppProvider({ instanceId: "mock-a", startFlow: "connected" });
    await providerA.start();
    const providerB = new MockWhatsAppProvider({ instanceId: "mock-b", startFlow: "connected" });
    await providerB.start();
    const registry = makeRegistry({ provider: providerA, rows: [accountRow()] });
    // Второй контекст — тот же fake-реестр с отдельным провайдером.
    const ctxB: WhatsAppSessionContext = {
      accountId: "acc-2",
      provider: providerB,
      ownership: makeOwnership(),
      sessionPath: join(sessionPath, "acc-2"),
      placeholder: false,
    };
    registry._contexts.set("acc-2", ctxB);

    const prisma = makePrisma();
    const service = runtime(prisma, makeSecurity(), makeConfig(), registry);
    service.onApplicationBootstrap();

    registry.fireLost("acc-1", "lease lost: not_owner");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(providerA.getSnapshot().state).toBe("DISCONNECTED");
    expect(providerB.getSnapshot().state).toBe("CONNECTED");

    await service.onApplicationShutdown();
    await providerA.stop("test");
    await providerB.stop("test");
  });
});
