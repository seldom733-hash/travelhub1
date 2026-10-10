import { describe, expect, it, jest } from "@jest/globals";
import { WhatsAppSessionsController } from "./whatsapp-sessions.controller";
import { DomainError, NotFoundError } from "../../shared/errors";
import { loadWhatsAppConfig } from "./whatsapp.config";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

/**
 * M5: контроллер /whatsapp/sessions — маршруты делегируют в реестр/runtime,
 * аудит создаётся только на create; QR ходит через общий rate-limiter.
 */

type Actor = AuthedRequest["user"];
const actor = { id: "user-1", username: "admin" } as unknown as Actor;
const otherActor = { id: "user-2", username: "other" } as unknown as Actor;

function makeController(
  overrides: {
    enabled?: boolean;
    accounts?: Array<Record<string, unknown>>;
    getAccount?: (id: string) => Record<string, unknown> | null;
    getStatus?: jest.Mock<(accountId?: string) => Promise<Record<string, unknown>>>;
    getQr?: jest.Mock<(accountId?: string) => Promise<string>>;
    connect?: jest.Mock;
    disconnect?: jest.Mock;
    archive?: jest.Mock;
    createAccount?: jest.Mock;
  } = {},
) {
  const registry = {
    enabled: overrides.enabled ?? true,
    listAccounts: jest.fn(async () => overrides.accounts ?? []),
    getAccount: jest.fn(async (id: string) =>
      overrides.getAccount ? overrides.getAccount(id) : ((overrides.accounts ?? []).find((a) => a["id"] === id) ?? null),
    ),
    createAccount: overrides.createAccount ?? jest.fn(async (label?: string) => ({ id: "acc-new", label: label ?? null })),
  };
  const runtime = {
    getStatus: overrides.getStatus ?? jest.fn(async () => ({ state: "DISCONNECTED" })),
    getQr: overrides.getQr ?? jest.fn(async () => "qr-data"),
    connect: overrides.connect ?? jest.fn(async () => ({ state: "CONNECTING" })),
    disconnect: overrides.disconnect ?? jest.fn(async () => ({ state: "DISCONNECTED" })),
    archive: overrides.archive ?? jest.fn(async () => ({ state: "DISCONNECTED" })),
  };
  const security = { audit: jest.fn(async () => undefined) };
  const config = loadWhatsAppConfig({
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PROVIDER: "mock",
    WHATSAPP_QR_RATE_LIMIT_MAX: "3",
    WHATSAPP_QR_RATE_LIMIT_WINDOW_MS: "60000",
  });
  const controller = new WhatsAppSessionsController(
    config,
    registry as never,
    runtime as never,
    security as never,
  );
  return { controller, registry, runtime, security };
}

describe("WhatsAppSessionsController (M5)", () => {
  it("GET /sessions: каждая строка получает status из runtime", async () => {
    const accounts = [
      { id: "acc-1", label: "Sales", archivedAt: null },
      { id: "acc-2", label: null, archivedAt: new Date() },
    ];
    const { controller, runtime } = makeController({
      accounts,
      getStatus: jest.fn(async (accountId?: string) => ({ state: `state:${String(accountId)}` })),
    });

    const result = await controller.list();
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0]).toMatchObject({ id: "acc-1", status: { state: "state:acc-1" } });
    expect(result.accounts[1]).toMatchObject({ id: "acc-2", status: { state: "state:acc-2" } });
    expect(runtime.getStatus).toHaveBeenCalledTimes(2);
  });

  it("GET /sessions/:id: неизвестный номер → 404; известный → row + status", async () => {
    const { controller } = makeController({ accounts: [{ id: "acc-1", label: "Ops" }] });

    await expect(controller.get("missing")).rejects.toThrow(NotFoundError);
    await expect(controller.get("acc-1")).resolves.toEqual({
      account: { id: "acc-1", label: "Ops", status: { state: "DISCONNECTED" } },
    });
  });

  it("POST /sessions: фича выключена → 503; иначе создание + audit whatsapp.account_created", async () => {
    const disabled = makeController({ enabled: false });
    await expect(disabled.controller.create({ label: "X" }, actor)).rejects.toMatchObject({ httpStatus: 503 });
    expect(disabled.registry.createAccount).not.toHaveBeenCalled();
    expect(disabled.security.audit).not.toHaveBeenCalled();

    const { controller, registry, security } = makeController();
    const result = await controller.create({ label: " Sales " }, actor);
    expect(result.account).toMatchObject({ id: "acc-new", status: { state: "DISCONNECTED" } });
    expect(registry.createAccount).toHaveBeenCalledWith(" Sales ");
    expect(security.audit).toHaveBeenCalledWith(undefined, expect.objectContaining({
      userId: "user-1",
      action: "whatsapp.account_created",
      resource: "WhatsAppAccount",
      resourceId: "acc-new",
    }));
  });

  it("POST /sessions/:id/connect|disconnect|archive: делегирует confirm и accountId в runtime", async () => {
    const { controller, runtime } = makeController();

    await controller.connect("acc-1", { confirm: true }, actor);
    expect(runtime.connect).toHaveBeenCalledWith(actor, true, "acc-1");

    await controller.disconnect("acc-1", actor);
    expect(runtime.disconnect).toHaveBeenCalledWith(actor, "acc-1");

    await controller.archive("acc-1", { confirm: true }, actor);
    expect(runtime.archive).toHaveBeenCalledWith(actor, true, "acc-1");
  });

  it("GET /sessions/:id/qr: rate-limit per-user (3/60s), дальше 429", async () => {
    const { controller } = makeController();

    expect(await controller.qr("acc-1", actor)).toEqual({ qr: "qr-data" });
    await controller.qr("acc-1", actor);
    await controller.qr("acc-1", actor);
    await expect(controller.qr("acc-1", actor)).rejects.toMatchObject({ httpStatus: 429 });

    // Другой пользователь — своё окно.
    await expect(controller.qr("acc-1", otherActor)).resolves.toEqual({ qr: "qr-data" });
  });

  it("propagation: DomainError 503 из реестра не маскируется", async () => {
    const { controller } = makeController({
      getAccount: () => {
        throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
      },
    });
    await expect(controller.get("acc-1")).rejects.toMatchObject({ httpStatus: 503 });
  });
});
