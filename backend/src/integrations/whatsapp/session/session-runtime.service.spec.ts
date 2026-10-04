import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { WhatsAppSessionRuntimeService } from "./session-runtime.service";
import { loadWhatsAppConfig, type WhatsAppConfig } from "../whatsapp.config";
import { MockWhatsAppProvider } from "../provider/mock/mock-whatsapp.provider";
import { WhatsAppSessionOwnershipService } from "../ownership/session-ownership.service";
import { ConflictError, DomainError, ValidationDomainError } from "../../../shared/errors";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";

const ACTOR = { id: "user-1", username: "operator" };
const HANDLE = { instanceId: "host:1:abc", fencingToken: 7, expiresAt: new Date(Date.now() + 45_000), renewedAt: new Date() };

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
  return {
    whatsAppAccount: {
      findFirst: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      create: jest.fn<() => Promise<{ id: string; state: string; phone: string | null; connectedAt: Date | null; lastDisconnectedAt: Date | null; lastError: string | null }>>().mockResolvedValue({
        id: "acc-1",
        state: "DISCONNECTED",
        phone: null,
        connectedAt: null,
        lastDisconnectedAt: null,
        lastError: null,
      }),
      update: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
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

describe("WhatsAppSessionRuntimeService (M2, §6.2/§6.4)", () => {
  let sessionPath: string;

  beforeEach(() => {
    sessionPath = mkdtempSync(join(tmpdir(), "wa-runtime-db-"));
  });

  afterEach(() => {
    rmSync(sessionPath, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it("getStatus: фича выключена → enabled=false, state из БД-фолбэка, без падений", async () => {
    const config = loadWhatsAppConfig({});
    const runtime = new WhatsAppSessionRuntimeService(makePrisma(), makeSecurity(), makeOwnership(), config, null);
    const status = await runtime.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.provider).toBe("baileys");
    expect(status.state).toBe("DISCONNECTED");
    expect(status.hasQr).toBe(false);
    expect(status.instanceId).toBeNull();
  });

  it("getStatus: live-снимок провайдера приоритетнее строки БД", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const runtime = new WhatsAppSessionRuntimeService(makePrisma(), makeSecurity(), makeOwnership(), makeConfig(), provider);
    const status = await runtime.getStatus();
    expect(status.state).toBe("CONNECTED");
    expect(status.instanceId).toBe("mock-1");
    expect(status.enabled).toBe(true);
    expect(status.reconnect.maxAttempts).toBeGreaterThan(0);
    await provider.stop("test");
  });

  it("getQr: только state=QR_REQUIRED; иначе ConflictError; выключено → 503", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "qr" });
    await provider.start();
    const runtime = new WhatsAppSessionRuntimeService(makePrisma(), makeSecurity(), makeOwnership(), makeConfig(), provider);
    expect(runtime.getQr()).toMatch(/^mock-qr-/);
    provider.driveState("CONNECTING");
    provider.driveState("CONNECTED");
    expect(() => runtime.getQr()).toThrow(ConflictError);

    const disabled = new WhatsAppSessionRuntimeService(makePrisma(), makeSecurity(), makeOwnership(), loadWhatsAppConfig({}), null);
    try {
      disabled.getQr();
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
    const runtime = new WhatsAppSessionRuntimeService(
      makePrisma(),
      security,
      ownership,
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );

    await expect(runtime.connect(ACTOR, false)).rejects.toBeInstanceOf(ValidationDomainError);
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

    const status = await runtime.connect(ACTOR, true);
    expect(order).toEqual(["ownership", "start"]);
    expect(status.state).toBe("CONNECTED");
    expect(security.audit).toHaveBeenCalledTimes(1);
    const auditArgs = (security.audit as jest.Mock).mock.calls[0] as unknown as [
      unknown,
      { action: string; userId: string; details: Record<string, unknown> },
    ];
    expect(auditArgs[1].action).toBe("whatsapp.connected");
    expect(auditArgs[1].userId).toBe("user-1");
    expect(auditArgs[1].details["fencingToken"]).toBe(7);
    await provider.stop("test");
  });

  it("connect/disconnect/logout/session-reset: выключено → 503 (никакого провайдера нет)", async () => {
    const runtime = new WhatsAppSessionRuntimeService(makePrisma(), makeSecurity(), makeOwnership(), loadWhatsAppConfig({}), null);
    for (const call of [
      () => runtime.connect(ACTOR, true),
      () => runtime.disconnect(ACTOR),
      () => runtime.logout(ACTOR, true),
      () => runtime.sessionReset(ACTOR, true),
    ]) {
      await expect(call()).rejects.toMatchObject({ httpStatus: 503 });
    }
  });

  it("disconnect: assertActive ДО stop + audit whatsapp.disconnected", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const ownership = makeOwnership();
    const security = makeSecurity();
    const runtime = new WhatsAppSessionRuntimeService(
      makePrisma(),
      security,
      ownership,
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );

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

    const status = await runtime.disconnect(ACTOR);
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
    const runtime = new WhatsAppSessionRuntimeService(
      makePrisma(),
      security,
      makeOwnership(),
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );

    await expect(runtime.logout(ACTOR, false)).rejects.toBeInstanceOf(ValidationDomainError);
    await runtime.logout(ACTOR, true);
    expect((security.audit as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      action: "whatsapp.logout",
      details: { fencingToken: 7 },
    });
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
  });

  it("session-reset: confirm обязателен; wipe локального auth-state + audit whatsapp.session_reset", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const security = makeSecurity();
    const runtime = new WhatsAppSessionRuntimeService(
      makePrisma(),
      security,
      makeOwnership(),
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );

    await expect(runtime.sessionReset(ACTOR, false)).rejects.toBeInstanceOf(ValidationDomainError);
    await runtime.sessionReset(ACTOR, true);
    expect((security.audit as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      action: "whatsapp.session_reset",
      details: { wipedLocalSession: true },
    });
    await provider.stop("test");
  });

  it("autoConnect=false → bootstrap не дёргает start; state-change персистится в WhatsAppAccount", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    const prisma = makePrisma();
    const runtime = new WhatsAppSessionRuntimeService(
      prisma,
      makeSecurity(),
      makeOwnership(),
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );
    runtime.onApplicationBootstrap();
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

    await runtime.onApplicationShutdown();
    await provider.stop("test");
  });

  it("autoConnect bootstrap: системный актор аудируется с userId=null (без FK AuditLog)", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    const security = makeSecurity();
    const runtime = new WhatsAppSessionRuntimeService(
      makePrisma(),
      security,
      makeOwnership(),
      makeConfig({ WHATSAPP_AUTO_CONNECT: "true", WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );
    runtime.onApplicationBootstrap();
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
    await runtime.onApplicationShutdown();
    await provider.stop("test");
  });

  it("потеряlease: ownership.onLost → provider.stop + строка Account в ERROR", async () => {
    const provider = new MockWhatsAppProvider({ instanceId: "mock-1", startFlow: "connected" });
    await provider.start();
    const prisma = makePrisma();
    let lostListener: ((reason: string) => void) | null = null;
    const ownership = {
      ensureOwnership: jest.fn(async () => HANDLE),
      assertActive: jest.fn(async () => HANDLE),
      onLost: jest.fn((cb: (reason: string) => void) => {
        lostListener = cb;
        return () => {};
      }),
      current: { ...HANDLE },
    } as unknown as WhatsAppSessionOwnershipService;

    const runtime = new WhatsAppSessionRuntimeService(
      prisma,
      makeSecurity(),
      ownership,
      makeConfig({ WHATSAPP_SESSION_PATH: sessionPath }),
      provider,
    );
    runtime.onApplicationBootstrap();
    expect(lostListener).not.toBeNull();

    lostListener!("lease lost: not_owner");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
    const updates = (prisma.whatsAppAccount.update as jest.Mock).mock.calls as Array<[{ data: { state: string; lastError: string | null } }]>;
    const last = updates[updates.length - 1]?.[0];
    expect(last?.data.state).toBe("ERROR");
    expect(last?.data.lastError).toContain("lease lost");

    await runtime.onApplicationShutdown();
    await provider.stop("test");
  });
});
