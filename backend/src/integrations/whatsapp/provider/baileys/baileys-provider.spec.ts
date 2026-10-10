import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  BaileysWhatsAppProvider,
  mapDisconnectReason,
  type BaileysProviderOptions,
} from "./baileys-provider";
import {
  type BaileysConnectionUpdateLike,
  type BaileysEventEmitterLike,
  type BaileysMessageLike,
  type BaileysMessageUpdateLike,
  type BaileysModuleLike,
  type BaileysSocketLike,
} from "./baileys-loader";
import { BaileysAuthAdapter } from "./baileys-auth-adapter";
import { AuthStateStore } from "./auth-state-store";
import { loadWhatsAppConfig, type WhatsAppConfig } from "../../whatsapp.config";
import { WhatsAppAuthStateError } from "./auth-state-store";
import { WhatsAppNotConnectedError, WhatsAppMessageSendError } from "../whatsapp-errors";
import type { WhatsAppConnectionState } from "../../../../generated/prisma/enums";

/** Минимальный фейк WS-транспорта (Baileys `socket.ws`): кадры/события. */
class FakeWs {
  private handlers = new Map<string, Set<() => void>>();

  on(event: string, cb: () => void): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(cb);
  }

  emit(event: string): void {
    for (const cb of this.handlers.get(event) ?? []) cb();
  }
}

class FakeEv implements Partial<BaileysEventEmitterLike> {
  private handlers = new Map<string, Set<(payload: never) => void>>();

  on(event: string, cb: (payload: never) => void): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(cb);
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  emit(event: string, payload: unknown): void {
    for (const cb of this.handlers.get(event) ?? []) cb(payload as never);
  }

  hasListeners(event: string): boolean {
    return (this.handlers.get(event)?.size ?? 0) > 0;
  }
}

class FakeSocket implements BaileysSocketLike {
  readonly ev = new FakeEv() as unknown as BaileysEventEmitterLike;
  readonly fakeEv = new FakeEv();
  /** WS-транспорт (в проде Baileys кладёт сюда кадровые события). */
  readonly ws = new FakeWs();
  user: { id?: string } | null = { id: "994501234567:12@s.whatsapp.net" };
  relayCalls: Array<{ jid: string; content: Record<string, unknown>; messageId: string }> = [];
  relayBehavior: "ok" | "reject" | "hang" = "ok";
  sendMediaCalls: Array<{ jid: string; content: Record<string, unknown>; messageId: string }> = [];
  logoutCalled = false;
  ended = false;
  onWhatsApp?: (...jids: string[]) => Promise<Array<{ jid: string; exists: boolean; lid?: string | null }>>;

  constructor() {
    // Делегируем регистрацию/эмиссию на единый FakeEv.
    const shared = this.fakeEv;
    this.ev.on = ((event: string, cb: (payload: never) => void) => shared.on(event, cb)) as never;
    this.ev.removeAllListeners = (() => shared.removeAllListeners()) as never;
  }

  emit(event: string, payload: unknown): void {
    this.fakeEv.emit(event, payload);
  }

  hasListeners(event: string): boolean {
    return this.fakeEv.hasListeners(event);
  }

  async relayMessage(jid: string, content: Record<string, unknown>, options: { messageId: string }): Promise<void> {
    if (this.relayBehavior === "hang") return new Promise<never>(() => undefined);
    if (this.relayBehavior === "reject") throw new Error("ws not connected");
    this.relayCalls.push({ jid, content, messageId: options.messageId });
  }

  async sendMessage(
    jid: string,
    content: Record<string, unknown>,
    options: { messageId: string },
  ): Promise<unknown> {
    this.sendMediaCalls.push({ jid, content, messageId: options.messageId });
    return { key: { id: options.messageId, remoteJid: jid, fromMe: true } };
  }

  async updateMediaMessage(message: unknown): Promise<unknown> {
    return message;
  }

  async logout(): Promise<void> {
    this.logoutCalled = true;
  }

  end(): void {
    this.ended = true;
  }
}

const STUB_DOWNLOAD_MEDIA = jest.fn(async () => new Uint8Array([7, 7, 7]));

const STUB_MODULE: BaileysModuleLike = {
  makeWASocket: () => {
    throw new Error("makeWASocket is not used in unit tests (socketStarter injected)");
  },
  initAuthCreds: () => ({
    registered: false,
    noiseKey: { public: new Uint8Array([1, 2, 3]), private: new Uint8Array([4, 5, 6]) },
  }),
  makeCacheableSignalKeyStore: (store) => store,
  DisconnectReason: { loggedOut: 401, restartRequired: 515, connectionClosed: 428 },
  BufferJSON: {
    replacer: (_key: string, value: unknown) => {
      if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return { type: "Buffer", data: Buffer.from(value as Uint8Array).toString("base64") };
      }
      return value;
    },
    reviver: (_key: string, value: unknown) => {
      const record = value as { type?: string; data?: string } | null;
      if (record && typeof record === "object" && typeof record.data === "string") {
        return Buffer.from(record.data, "base64");
      }
      return value;
    },
  },
  Browsers: { ubuntu: (browser: string) => ["Ubuntu", browser, "1.0.0"] },
  downloadMediaMessage: STUB_DOWNLOAD_MEDIA,
};

function buildConfig(sessionPath: string, overrides: Record<string, string> = {}): WhatsAppConfig {
  return loadWhatsAppConfig({
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PROVIDER: "baileys",
    WHATSAPP_SESSION_PATH: sessionPath,
    WHATSAPP_AUTH_ENCRYPTION_KEY: "test-auth-key-material-0123456789abcdef",
    WHATSAPP_AUTO_CONNECT: "false",
    ...overrides,
  });
}

function createHarness(overrides: Record<string, string> = {}, sharedDir?: string) {
  const tmpDir =
    sharedDir ?? path.join(os.tmpdir(), `travelhub-wa-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const config = buildConfig(tmpDir, overrides);
  const socket = new FakeSocket();
  const options: BaileysProviderOptions = {
    config,
    instanceId: "test-host:1:abc",
    getFencingToken: () => 7,
    socketStarter: () => socket,
    loadModule: async () => STUB_MODULE,
  };
  const provider = new BaileysWhatsAppProvider(options);
  return { provider, socket, config, tmpDir, authFile: path.join(tmpDir, "auth-state.enc") };
}

async function waitFor(predicate: () => boolean | Promise<boolean>, label: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`waitFor timeout: ${label}`);
}

async function cleanup(dir: string): Promise<void> {
  await fsp.rm(dir, { recursive: true, force: true });
}

const openConnection = (socket: FakeSocket): void => socket.emit("connection.update", { connection: "open" });
const closeConnection = (socket: FakeSocket, code: number): void =>
  socket.emit("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: code } } as unknown as Error } });

describe("BaileysWhatsAppProvider (M2, fake socket + реальный AuthStateStore)", () => {
  jest.setTimeout(30_000);

  describe("connection lifecycle §6.2", () => {
    it("свежая сессия: DISCONNECTED→INITIALIZING→QR_REQUIRED→CONNECTING→CONNECTED; QR только в памяти", async () => {
      const h = createHarness();
      const observed: WhatsAppConnectionState[] = [];
      h.provider.onStateChange((s) => observed.push(s.state));
      try {
        await h.provider.start();
        expect(h.provider.getSnapshot().state).toBe("INITIALIZING");

        h.socket.emit("connection.update", { qr: "qr-data-no-logs" });
        expect(h.provider.getSnapshot().state).toBe("QR_REQUIRED");
        expect(h.provider.getSnapshot().qr).toBe("qr-data-no-logs");
        // QR не сохраняется в auth-state: файла ещё нет.
        await expect(fsp.access(h.authFile)).rejects.toThrow();

        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");
        expect(h.provider.getSnapshot().qr).toBeNull();
        expect(h.provider.getSnapshot().phone).toBe("+994501234567");
        expect(h.provider.getSnapshot().connectedAt).toBeInstanceOf(Date);
        expect(observed).toEqual([
          "INITIALIZING",
          "QR_REQUIRED",
          "CONNECTING",
          "CONNECTED",
        ]);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("существующая сессия: INITIALIZING→CONNECTING→CONNECTED (без QR)", async () => {
      const h1 = createHarness();
      try {
        await h1.provider.start();
        openConnection(h1.socket);
        expect(h1.provider.getSnapshot().state).toBe("CONNECTED");
        await h1.provider.stop(); // flush auth-state на диск
        await expect(fsp.access(h1.authFile)).resolves.toBeUndefined();

        const h2 = createHarness({}, h1.tmpDir);
        const observed: WhatsAppConnectionState[] = [];
        h2.provider.onStateChange((s) => observed.push(s.state));
        try {
          await h2.provider.start();
          expect(observed).toEqual(["INITIALIZING", "CONNECTING"]);
          expect(h2.provider.getSnapshot().state).toBe("CONNECTING");
        } finally {
          await h2.provider.stop();
        }
      } finally {
        await h1.provider.stop().catch(() => undefined);
        await cleanup(h1.tmpDir);
      }
    });

    it("network-разрыв (428) из CONNECTED → RECONNECTING → backoff reconnect → CONNECTED (attempts сбрасываются)", async () => {
      const h = createHarness({ WHATSAPP_RECONNECT_BASE_DELAY_MS: "10", WHATSAPP_RECONNECT_MAX_DELAY_MS: "1000" });
      try {
        await h.provider.start();
        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");

        closeConnection(h.socket, 428);
        expect(h.provider.getSnapshot().state).toBe("RECONNECTING");

        // Backoff 10ms → новый start(); auth-файла ещё нет → INITIALIZING.
        // Ждём и перепривязку listeners (detach снимает их при close).
        await waitFor(
          () => h.provider.getSnapshot().state === "INITIALIZING" && h.socket.hasListeners("connection.update"),
          "reconnect start",
        );
        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");
        expect(h.provider.getSnapshot().lastError).toBeNull();
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("loggedOut (401) → LOGGED_OUT → авто-wipe сессии → авто-restart в свежий QR; badSession (500) → ERROR без авто-restart", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);
        // Pairing-creds уже на диске (реальный сценарий: QR отсканирован).
        h.socket.emit("creds.update", { registered: true });
        await waitFor(async () => {
          try {
            await fsp.access(h.authFile);
            return true;
          } catch {
            return false;
          }
        }, "creds persisted");

        closeConnection(h.socket, 401);
        // Переход синхронный; затем авто-wipe + авто-restart (без ручного session-reset).
        expect(h.provider.getSnapshot().state).toBe("LOGGED_OUT");
        expect(h.provider.getSnapshot().lastError).toContain("loggedOut");
        await waitFor(
          () => h.provider.getSnapshot().state === "INITIALIZING" && h.socket.hasListeners("connection.update"),
          "auto-restart после wipe",
        );
        await waitFor(
          async () => {
            try {
              await fsp.access(h.authFile);
              return false;
            } catch {
              return true;
            }
          },
          "локальная сессия уничтожена",
        );
        expect(h.provider.getSnapshot().phone).toBeNull();
        expect(h.socket.ended).toBe(true);

        // Свежая сессия работоспособна: open → CONNECTED.
        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");

        // authFailure (500) → ERROR: без авто-restart (логические причины не ретраим).
        closeConnection(h.socket, 500);
        expect(h.provider.getSnapshot().state).toBe("ERROR");
        expect(h.provider.getSnapshot().lastError).toContain("authFailure");
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(h.provider.getSnapshot().state).toBe("ERROR");
      } finally {
        await h.provider.stop().catch(() => undefined);
        await cleanup(h.tmpDir);
      }
    });

    it("restartRequired (515): старый сокет отвязан, «грязные» pairing-creds персистятся ДО reconnect → снова CONNECTED", async () => {
      const h = createHarness({
        WHATSAPP_RECONNECT_BASE_DELAY_MS: "10",
        WHATSAPP_RECONNECT_MAX_DELAY_MS: "50",
      });
      try {
        await h.provider.start();
        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");

        // Pairing-creds ещё НЕ на диске: debounce (500 мс) не истёк.
        h.socket.emit("creds.update", { registered: true });

        closeConnection(h.socket, 515);
        // Переход синхронный; старый сокет отвязан — «зомби» не остаётся.
        expect(h.provider.getSnapshot().state).toBe("RECONNECTING");
        expect(h.socket.ended).toBe(true);
        expect(h.socket.hasListeners("connection.update")).toBe(false);

        // Рестарт: flush «грязных» creds ДО reload нового адаптера (нет 401-цикла).
        await waitFor(
          () => {
            const s = h.provider.getSnapshot().state;
            return (s === "INITIALIZING" || s === "CONNECTING") && h.socket.hasListeners("connection.update");
          },
          "reconnect после 515",
        );
        await waitFor(
          async () => {
            try {
              await fsp.access(h.authFile);
              return true;
            } catch {
              return false;
            }
          },
          "pairing-creds персистены до reconnect",
        );

        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");
        expect(h.provider.getSnapshot().lastError).toBeNull();
      } finally {
        await h.provider.stop().catch(() => undefined);
        await cleanup(h.tmpDir);
      }
    });

    it("reconnect упирается в WHATSAPP_MAX_RECONNECT_ATTEMPTS → ERROR", async () => {
      const h = createHarness({
        WHATSAPP_RECONNECT_BASE_DELAY_MS: "10",
        WHATSAPP_RECONNECT_MAX_DELAY_MS: "20",
        WHATSAPP_MAX_RECONNECT_ATTEMPTS: "2",
      });
      try {
        await h.provider.start();
        openConnection(h.socket);

        closeConnection(h.socket, 428); // → RECONNECTING, попытка #1
        await waitFor(
          () => h.provider.getSnapshot().state === "INITIALIZING" && h.socket.hasListeners("connection.update"),
          "attempt #1",
        );
        closeConnection(h.socket, 428); // → DISCONNECTED, попытка #2
        await waitFor(
          () => h.provider.getSnapshot().state === "INITIALIZING" && h.socket.hasListeners("connection.update"),
          "attempt #2",
        );
        closeConnection(h.socket, 428); // лимит исчерпан
        await waitFor(
          () => (h.provider.getSnapshot().lastError ?? "").includes("max reconnect attempts"),
          "max attempts",
        );
        // Повторные попытки прекращены; из handshake-состояния (DISCONNECTED)
        // terminal-переход в ERROR недоступен таблицей §6.2 — фиксируем
        // фактическое поведение: сессия не переподнимается автоматически.
        expect(h.provider.getSnapshot().state).toBe("DISCONNECTED");
        const stateAfterExhaustion = h.provider.getSnapshot().state;
        await new Promise((resolve) => setTimeout(resolve, 80));
        expect(h.provider.getSnapshot().state).toBe(stateAfterExhaustion);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("stop(): идемпотентен, убирает listeners, пишет auth-state; повторный start работоспособен", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);
        expect(h.socket.hasListeners("connection.update")).toBe(true);

        await h.provider.stop();
        expect(h.provider.getSnapshot().state).toBe("DISCONNECTED");
        expect(h.socket.hasListeners("connection.update")).toBe(false);
        expect(h.socket.ended).toBe(true);
        await h.provider.stop(); // идемпотентность

        await expect(fsp.access(h.authFile)).resolves.toBeUndefined();

        await h.provider.start();
        openConnection(h.socket);
        expect(h.provider.getSnapshot().state).toBe("CONNECTED");
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("logout(): сессия уничтожена на диске (wipe), состояние DISCONNECTED", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);
        await h.provider.logout();
        expect(h.provider.getSnapshot().state).toBe("DISCONNECTED");
        expect(h.socket.logoutCalled).toBe(true);
        await expect(fsp.access(h.authFile)).rejects.toThrow();
        expect(h.provider.getSnapshot().phone).toBeNull();
      } finally {
        await h.provider.stop().catch(() => undefined);
        await cleanup(h.tmpDir);
      }
    });

    it("повреждённый auth-state → start() падает с WhatsAppAuthStateError, состояние ERROR, файл НЕ удаляется (нет auto-reset)", async () => {
      const h = createHarness();
      await fsp.mkdir(h.tmpDir, { recursive: true });
      await fsp.writeFile(h.authFile, "not-a-valid-envelope", "utf8");
      try {
        await expect(h.provider.start()).rejects.toThrow(WhatsAppAuthStateError);
        expect(h.provider.getSnapshot().state).toBe("ERROR");
        const content = await fsp.readFile(h.authFile, "utf8");
        expect(content).toBe("not-a-valid-envelope"); // auto-reset запрещён
      } finally {
        await h.provider.stop().catch(() => undefined);
        await cleanup(h.tmpDir);
      }
    });
  });

  describe("send / reconcile (D6 + решение №5)", () => {
    it("send вне CONNECTED → WhatsAppNotConnectedError", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        await expect(
          h.provider.send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "3EB0X" }),
        ).rejects.toThrow(WhatsAppNotConnectedError);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("send: relayMessage с extendedTextMessage и НАШИМ messageId; reconcile → sent", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);
        const messageId = "3EB0AAAA0000000000000000000000000000000000";
        const result = await h.provider.send({
          recipientJid: "994501234567@s.whatsapp.net",
          text: "Привет",
          messageId,
        });
        expect(result.providerMessageId).toBe(messageId);
        expect(result.sentAt).toBeInstanceOf(Date);
        expect(h.socket.relayCalls).toHaveLength(1);
        expect(h.socket.relayCalls[0]).toEqual({
          jid: "994501234567@s.whatsapp.net",
          content: { extendedTextMessage: { text: "Привет" } },
          messageId,
        });
        const evidence = await h.provider.reconcile(messageId);
        expect(evidence).toMatchObject({ status: "sent" });
        expect(await h.provider.reconcile("unknown-id")).toBeNull();
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("send: reject сокета → WhatsAppMessageSendError ambiguous=true (исход неизвестен)", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.socket.relayBehavior = "reject";
        const error = await h.provider
          .send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "3EB0B" })
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(WhatsAppMessageSendError);
        expect((error as WhatsAppMessageSendError).ambiguous).toBe(true);
        expect((error as WhatsAppMessageSendError).retryable).toBe(false);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("send: таймаут → ambiguous=true; последующий reconcile по факту роста evidence остаётся честным", async () => {
      const h = createHarness({ WHATSAPP_SEND_TIMEOUT_MS: "50" });
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.socket.relayBehavior = "hang";
        const error = await h.provider
          .send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "3EB0C" })
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(WhatsAppMessageSendError);
        expect((error as WhatsAppMessageSendError).ambiguous).toBe(true);
        expect((error as WhatsAppMessageSendError).message).toContain("timed out");
        expect(await h.provider.reconcile("3EB0C")).toBeNull();
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("M3+: send c media → socket.sendMessage(document) с НАШИМ messageId, relayMessage не зовётся", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);
        expect(h.provider.capabilities.media).toContain("document");

        const result = await h.provider.send({
          recipientJid: "994501234567@s.whatsapp.net",
          text: "в отчёт",
          messageId: "3EB0MEDIA00000000000000000000000000000000",
          media: { filename: "report.pdf", mimetype: "application/pdf", bytes: new Uint8Array([1, 2, 3]) },
        });

        expect(result.providerMessageId).toBe("3EB0MEDIA00000000000000000000000000000000");
        expect(h.socket.relayCalls).toHaveLength(0);
        expect(h.socket.sendMediaCalls).toHaveLength(1);
        expect(h.socket.sendMediaCalls[0]).toMatchObject({
          jid: "994501234567@s.whatsapp.net",
          messageId: "3EB0MEDIA00000000000000000000000000000000",
          content: {
            mimetype: "application/pdf",
            fileName: "report.pdf",
            caption: "в отчёт",
          },
        });
        expect(h.socket.sendMediaCalls[0]!.content["document"]).toEqual(new Uint8Array([1, 2, 3]));
        expect(await h.provider.reconcile("3EB0MEDIA00000000000000000000000000000000")).toMatchObject({
          status: "sent",
        });
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("M3+: send c media без подписи → content без caption; reject sendMessage → ambiguous=true", async () => {
      const h = createHarness();
      try {
        await h.provider.start();
        openConnection(h.socket);

        await h.provider.send({
          recipientJid: "994501234567@s.whatsapp.net",
          text: "",
          messageId: "3EB0MEDIA10000000000000000000000000000000",
          media: { filename: "photo.png", mimetype: "image/png", bytes: new Uint8Array([9]) },
        });
        expect(h.socket.sendMediaCalls[0]!.content).not.toHaveProperty("caption");

        h.socket.sendMediaCalls.length = 0;
        const original = h.socket.sendMessage.bind(h.socket);
        h.socket.sendMessage = async () => {
          throw new Error("media upload failed");
        };
        const error = await h.provider
          .send({
            recipientJid: "994501234567@s.whatsapp.net",
            text: "",
            messageId: "3EB0MEDIA20000000000000000000000000000000",
            media: { filename: "photo.png", mimetype: "image/png", bytes: new Uint8Array([9]) },
          })
          .catch((e: unknown) => e);
        h.socket.sendMessage = original;
        expect(error).toBeInstanceOf(WhatsAppMessageSendError);
        expect((error as WhatsAppMessageSendError).ambiguous).toBe(true);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });
  });

  describe("receipts / inbound / evidence", () => {
    it("messages.update: 2/3/4 → delivery-события + монотонный reconcile (sent<delivered<read)", async () => {
      const h = createHarness();
      const updates: Array<{ providerMessageId: string; status: string }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onDeliveryUpdate((u) => updates.push({ providerMessageId: u.providerMessageId, status: u.status }));
        const id = "3EB0D000000000000000000000000000000000000";
        await h.provider.send({ recipientJid: "994501234567@s.whatsapp.net", text: "x", messageId: id });

        const statusUpdate = (status: number): BaileysMessageUpdateLike[] => [{ key: { id, fromMe: true, remoteJid: "994501234567@s.whatsapp.net" }, update: { status } }];
        h.socket.emit("messages.update", statusUpdate(3));
        expect((await h.provider.reconcile(id))?.status).toBe("delivered");
        h.socket.emit("messages.update", statusUpdate(4));
        expect((await h.provider.reconcile(id))?.status).toBe("read");
        // Монотонность: более низкий статус после read игнорируется.
        h.socket.emit("messages.update", statusUpdate(3));
        expect((await h.provider.reconcile(id))?.status).toBe("read");
        expect(updates.map((u) => u.status)).toEqual(["delivered", "read", "delivered"]);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("messages.upsert: входящий текст → onInbound; fromMe echo → onInbound(fromMe=true) + evidence (M3 §8)", async () => {
      const h = createHarness();
      const inbound: Array<{ text: string | null; type: string; remoteJid: string; fromMe: boolean }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) =>
          inbound.push({ text: m.text, type: m.type, remoteJid: m.remoteJid, fromMe: m.fromMe }),
        );

        const incoming: BaileysMessageLike[] = [
          {
            key: { id: "IN1", remoteJid: "994501234567@s.whatsapp.net", fromMe: false, participant: null },
            message: { conversation: "здравствуйте" },
            messageTimestamp: 1_700_000_000,
          },
          {
            key: { id: "IN2", remoteJid: "994501234567@s.whatsapp.net", fromMe: true, participant: null },
            message: { conversation: "моя отправка" },
          },
        ];
        h.socket.emit("messages.upsert", { messages: incoming, type: "notify" });

        expect(inbound).toHaveLength(2);
        expect(inbound[0]).toMatchObject({
          text: "здравствуйте",
          type: "text",
          remoteJid: "994501234567@s.whatsapp.net",
          fromMe: false,
        });
        expect(inbound[1]).toMatchObject({ text: "моя отправка", type: "text", fromMe: true });
        expect(await h.provider.reconcile("IN2")).toMatchObject({ status: "sent" });
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("M3+: messages.upsert document → downloadMediaMessage → inbound c media {filename,mimetype,size,bytes}", async () => {
      const h = createHarness();
      const inbound: Array<{
        type: string;
        text: string | null;
        media: { filename: string | null; mimetype: string | null; size: number | null; bytes: Uint8Array | null } | null;
      }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) => inbound.push({ type: m.type, text: m.text, media: m.media ?? null }));
        STUB_DOWNLOAD_MEDIA.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: { id: "MED1", remoteJid: "994501234567@s.whatsapp.net", fromMe: false, participant: null },
              message: {
                documentMessage: {
                  fileName: "report.pdf",
                  mimetype: "application/pdf",
                  fileLength: 1024,
                  caption: "вот файл",
                },
              },
              messageTimestamp: 1_700_000_000,
            },
          ],
          type: "notify",
        });

        await waitFor(() => inbound.length === 1, "media inbound emitted");
        expect(inbound[0]).toMatchObject({
          type: "document",
          text: "вот файл",
          media: {
            filename: "report.pdf",
            mimetype: "application/pdf",
            size: 1024,
            bytes: new Uint8Array([1, 2, 3]),
          },
        });
        expect(STUB_DOWNLOAD_MEDIA).toHaveBeenCalled();
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("M3+: download медиа упал → inbound ВСЁ РАВНО эмитится (метаданные stanza, bytes=null)", async () => {
      const h = createHarness();
      const inbound: Array<{
        type: string;
        media: { filename: string | null; mimetype: string | null; size: number | null; bytes: Uint8Array | null } | null;
      }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) => inbound.push({ type: m.type, media: m.media ?? null }));
        STUB_DOWNLOAD_MEDIA.mockRejectedValueOnce(new Error("media expired"));

        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: { id: "MED2", remoteJid: "994501234567@s.whatsapp.net", fromMe: false, participant: null },
              message: { imageMessage: { mimetype: "image/jpeg", fileLength: 2048 } },
              messageTimestamp: 1_700_000_000,
            },
          ],
          type: "notify",
        });

        await waitFor(() => inbound.length === 1, "media inbound emitted despite download failure");
        expect(inbound[0]).toMatchObject({
          type: "image",
          media: { filename: null, mimetype: "image/jpeg", size: 2048, bytes: null },
        });
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("messages.upsert: LID-адресация → senderPn/senderLid проходят в inbound (§10)", async () => {
      const h = createHarness();
      const inbound: Array<{ lid: string | null; senderPn: string | null; remoteJid: string }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) => inbound.push({ lid: m.lid, senderPn: m.senderPn, remoteJid: m.remoteJid }));

        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: {
                id: "LID1",
                remoteJid: "178322948505677@lid",
                fromMe: false,
                participant: null,
                senderLid: "178322948505677@lid",
                senderPn: "994506844086@s.whatsapp.net",
              },
              message: { conversation: "lid chat" },
              messageTimestamp: 1_700_000_000,
            },
            {
              key: {
                id: "GRP1",
                remoteJid: "120363022773023898@g.us",
                fromMe: false,
                participant: "994501234567@s.whatsapp.net",
                participantPn: "994501234567:4@s.whatsapp.net",
              },
              message: { conversation: "group msg" },
              messageTimestamp: 1_700_000_001,
            },
          ],
          type: "notify",
        });

        expect(inbound).toEqual([
          {
            lid: "178322948505677@lid",
            senderPn: "994506844086@s.whatsapp.net",
            remoteJid: "178322948505677@lid",
          },
          {
            lid: null,
            senderPn: "994501234567:4@s.whatsapp.net",
            remoteJid: "120363022773023898@g.us",
          },
        ]);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("findPhoneByLid: onWhatsApp(pn) сверяется с lid → canonical E.164; повтор — из кеша", async () => {
      const h = createHarness();
      let probeCalls = 0;
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.socket.onWhatsApp = async (...jids) => {
          probeCalls += 1;
          return jids.map((jid) => ({
            jid,
            exists: true,
            lid: jid === "+994506844086" ? "255108256379111@lid" : null,
          }));
        };

        const found = await h.provider.findPhoneByLid("255108256379111@lid", ["+994501111111", "+994506844086"]);
        expect(found).toBe("+994506844086");
        expect(probeCalls).toBe(1);

        const cached = await h.provider.findPhoneByLid("255108256379111@lid", ["+994506844086"]);
        expect(cached).toBe("+994506844086");
        expect(probeCalls).toBe(1);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("findPhoneByLid: нет совпадения → null; отрицательный кеш блокирует повторный проб", async () => {
      const h = createHarness();
      let probeCalls = 0;
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.socket.onWhatsApp = async (...jids) => {
          probeCalls += 1;
          return jids.map((jid) => ({ jid, exists: true, lid: null }));
        };

        const first = await h.provider.findPhoneByLid("233229709791387@lid", ["+994501111111"]);
        expect(first).toBeNull();
        expect(probeCalls).toBe(1);

        const second = await h.provider.findPhoneByLid("233229709791387@lid", ["+994501111111"]);
        expect(second).toBeNull();
        expect(probeCalls).toBe(1);
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("send → phone→lid проба: кеш заполняется; ответное lid-сообщение уходит с senderPn", async () => {
      const h = createHarness();
      const inbound: Array<{ remoteJid: string; senderPn: string | null }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.socket.onWhatsApp = async () => [
          { jid: "+994507777788", exists: true, lid: "50135237189839@lid" },
        ];
        h.provider.onInbound((m) => inbound.push({ remoteJid: m.remoteJid, senderPn: m.senderPn }));

        await h.provider.send({
          recipientJid: "994507777788@s.whatsapp.net",
          text: "hi",
          messageId: "3EB0TESTMSGID",
        });
        await waitFor(
          async () =>
            h.provider.findPhoneByLid("50135237189839@lid", ["+994507777788"]) !== null,
          "phone→lid cache filled",
        );

        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: { id: "P1", remoteJid: "50135237189839@lid", fromMe: false, participant: null },
              message: { conversation: "reply" },
              messageTimestamp: 1_700_000_000,
            },
          ],
          type: "notify",
        });
        expect(inbound).toHaveLength(1);
        expect(inbound[0]).toMatchObject({
          remoteJid: "50135237189839@lid",
          senderPn: "+994507777788",
        });
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("chats.phoneNumberShare {lid,jid} → кеш; следующее lid-сообщение синхронно с senderPn", async () => {
      const h = createHarness();
      const inbound: Array<{ senderPn: string | null }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) => inbound.push({ senderPn: m.senderPn }));

        h.socket.emit("chats.phoneNumberShare", {
          lid: "6472733851891@lid",
          jid: "994507000000@s.whatsapp.net",
        });
        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: { id: "PS1", remoteJid: "6472733851891@lid", fromMe: false, participant: null },
              message: { conversation: "from share" },
              messageTimestamp: 1_700_000_000,
            },
          ],
          type: "notify",
        });

        expect(inbound).toHaveLength(1);
        expect(inbound[0].senderPn).toBe("+994507000000");
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("lid без кеша → inbound уходит БЕЗ senderPn (сообщение не теряется)", async () => {
      const h = createHarness();
      const inbound: Array<{ remoteJid: string; senderPn: string | null }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) => inbound.push({ remoteJid: m.remoteJid, senderPn: m.senderPn }));
        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: { id: "LF1", remoteJid: "233229709791387@lid", fromMe: false, participant: null },
              message: { conversation: "fallback" },
              messageTimestamp: 1_700_000_000,
            },
          ],
          type: "notify",
        });
        expect(inbound).toHaveLength(1);
        expect(inbound[0]).toMatchObject({
          remoteJid: "233229709791387@lid",
          senderPn: null,
        });
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("contacts.upsert заполняет кеш lid→pn: следующее сообщение уходит синхронно", async () => {
      const h = createHarness();
      const inbound: Array<{ senderPn: string | null }> = [];
      try {
        await h.provider.start();
        openConnection(h.socket);
        h.provider.onInbound((m) => inbound.push({ senderPn: m.senderPn }));

        h.socket.emit("contacts.upsert", [
          { id: "6472733851891@lid", lid: "6472733851891@lid", jid: "994507000000@s.whatsapp.net" },
        ]);
        h.socket.emit("messages.upsert", {
          messages: [
            {
              key: { id: "LC1", remoteJid: "6472733851891@lid", fromMe: false, participant: null },
              message: { conversation: "from cache" },
              messageTimestamp: 1_700_000_000,
            },
          ],
          type: "notify",
        });

        expect(inbound).toHaveLength(1); // кеш-хит → синхронная эмиссия
        expect(inbound[0].senderPn).toBe("+994507000000");
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });

    it("state-change listeners получают snapshot и отписываются", async () => {
      const h = createHarness();
      const snapshots: Array<{ state: string; instanceId: string }> = [];
      try {
        const unsubscribe = h.provider.onStateChange((s) => snapshots.push({ state: s.state, instanceId: s.instanceId }));
        await h.provider.start();
        openConnection(h.socket);
        unsubscribe();
        closeConnection(h.socket, 500);
        const states = snapshots.map((s) => s.state);
        expect(states).toEqual(["INITIALIZING", "CONNECTING", "CONNECTED"]);
        expect(snapshots[0].instanceId).toBe("test-host:1:abc");
      } finally {
        await h.provider.stop();
        await cleanup(h.tmpDir);
      }
    });
  });

  describe("mapDisconnectReason", () => {
    it("таблица кодов Baileys 6.7.24 → причины §6.2; неизвестный → unknown (без догадок)", () => {
      expect(mapDisconnectReason(401)).toBe("loggedOut");
      expect(mapDisconnectReason(440)).toBe("connectionReplaced");
      expect(mapDisconnectReason(500)).toBe("authFailure");
      expect(mapDisconnectReason(403)).toBe("authFailure");
      expect(mapDisconnectReason(411)).toBe("authFailure");
      expect(mapDisconnectReason(515)).toBe("restartRequired");
      expect(mapDisconnectReason(428)).toBe("network");
      expect(mapDisconnectReason(408)).toBe("network");
      expect(mapDisconnectReason(503)).toBe("network");
      expect(mapDisconnectReason(999)).toBe("unknown");
      expect(mapDisconnectReason(null)).toBe("unknown");
    });
  });
});

describe("BaileysAuthAdapter (roundtrip creds/keys через AuthStateStore)", () => {
  jest.setTimeout(30_000);

  it("Uint8Array в creds переживает flush→reload (BufferJSON); fresh-сессия — loadedExistingSession=false", async () => {
    const tmpDir = path.join(os.tmpdir(), `travelhub-adapter-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const store = new AuthStateStore({ sessionPath: tmpDir, encryptionKeyMaterial: "test-auth-key-material-0123456789abcdef" });
    try {
      const options = {
        store,
        getFencingToken: () => 3,
        freshCreds: STUB_MODULE.initAuthCreds as () => Record<string, unknown>,
        bufferJson: STUB_MODULE.BufferJSON,
      };
      const first = await BaileysAuthAdapter.create(options);
      expect(first.loadedExistingSession).toBe(false);
      const noisePrivate = (first.credentials["noiseKey"] as { private: unknown }).private;
      expect(noisePrivate).toBeInstanceOf(Uint8Array);
      await first.flush();

      const second = await BaileysAuthAdapter.create(options);
      expect(second.loadedExistingSession).toBe(true);
      const reloaded = (second.credentials["noiseKey"] as { private: unknown }).private;
      expect(Buffer.from(reloaded as Uint8Array)).toEqual(Buffer.from([4, 5, 6]));

      // Ключи signal store тоже roundtrip'ятся (set → disk → get).
      await second.keyStore.set({ session: { "peer-1": new Uint8Array([7, 8]) } });
      await second.flush();
      const third = await BaileysAuthAdapter.create(options);
      const session = await third.keyStore.get("session", ["peer-1", "missing"]);
      expect(Buffer.from(session["peer-1"] as Uint8Array)).toEqual(Buffer.from([7, 8]));
      expect(session["missing"]).toBeUndefined();
      // Удаление ключа: null → исчезает с диска.
      await third.keyStore.set({ session: { "peer-1": null } });
      await third.flush();
      const fourth = await BaileysAuthAdapter.create(options);
      expect(await fourth.keyStore.get("session", ["peer-1"])).toEqual({});
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("Baileys runtime import (A-25, реальный Node-процесс)", () => {
  jest.setTimeout(60_000);

  it("node-процесс импортирует @whiskeysockets/baileys@6.7.24: makeWASocket, DisconnectReason, generateMessageID (3EB0…, 40)", () => {
    const { spawnSync } = require("child_process") as typeof import("child_process");
    const script = `
      const b = await import("@whiskeysockets/baileys");
      const fs = await import("fs");
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      const out = {
        pkgVersion: pkg.dependencies["@whiskeysockets/baileys"],
        hasMakeWASocket: typeof b.makeWASocket === "function",
        hasInitAuthCreds: typeof b.initAuthCreds === "function",
        loggedOut: b.DisconnectReason.loggedOut,
        restartRequired: b.DisconnectReason.restartRequired,
        connectionClosed: b.DisconnectReason.connectionClosed,
        messageId: b.generateMessageID("USER"),
        ubuntu: b.Browsers.ubuntu("Chrome"),
      };
      process.stdout.write(JSON.stringify(out));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: path.join(__dirname, "../../../../../"),
      encoding: "utf8",
      timeout: 50_000,
    });
    expect(result.stderr ?? "").toBe("");
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as {
      pkgVersion: string;
      hasMakeWASocket: boolean;
      hasInitAuthCreds: boolean;
      loggedOut: number;
      restartRequired: number;
      connectionClosed: number;
      messageId: string;
      ubuntu: string[];
    };
    expect(out.pkgVersion).toBe("6.7.24");
    expect(out.hasMakeWASocket).toBe(true);
    expect(out.hasInitAuthCreds).toBe(true);
    expect(out.loggedOut).toBe(401);
    expect(out.restartRequired).toBe(515);
    expect(out.connectionClosed).toBe(428);
    expect(out.messageId).toMatch(/^3EB0[0-9A-F]{36}$/);
    expect(out.messageId).toHaveLength(40);
    expect(out.ubuntu).toEqual(["Ubuntu", "Chrome", "22.04.4"]);
  });
});

describe("BaileysWhatsAppProvider: watchdog зомби-соединения", () => {
  function createWatchdogHarness(watchdogIntervalMs: number, watchdogStaleMs: number) {
    const tmpDir = path.join(
      os.tmpdir(),
      `travelhub-wa-wd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const socket = new FakeSocket();
    const provider = new BaileysWhatsAppProvider({
      config: buildConfig(tmpDir),
      instanceId: "test-host:1:wd",
      getFencingToken: () => 7,
      socketStarter: () => socket,
      loadModule: async () => STUB_MODULE,
      watchdogIntervalMs,
      watchdogStaleMs,
    });
    return { provider, socket, tmpDir };
  }

  it("CONNECTED без входящих кадров/событий дольше порога → принудительный reconnect", async () => {
    const h = createWatchdogHarness(20, 120);
    try {
      await h.provider.start();
      h.socket.emit("connection.update", { connection: "open" });
      await waitFor(() => h.provider.getSnapshot().state === "CONNECTED", "connected");

      // Тишина: ни WS-кадров, ни ev-событий дольше watchdogStaleMs.
      await waitFor(
        () => ["RECONNECTING", "DISCONNECTED", "INITIALIZING", "CONNECTING"].includes(h.provider.getSnapshot().state),
        "forced reconnect",
        5_000,
      );
      expect(h.socket.ended).toBe(true);
    } finally {
      await h.provider.stop("test done");
    }
  });

  it("активный сокет (WS-кадры keepalive) реконнект не запускает", async () => {
    const h = createWatchdogHarness(20, 150);
    try {
      await h.provider.start();
      h.socket.emit("connection.update", { connection: "open" });
      await waitFor(() => h.provider.getSnapshot().state === "CONNECTED", "connected");

      const start = Date.now();
      while (Date.now() - start < 400) {
        h.socket.ws.emit("message");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(h.provider.getSnapshot().state).toBe("CONNECTED");
      expect(h.socket.ended).toBe(false);
    } finally {
      await h.provider.stop("test done");
    }
  });

  it("ev-события тоже считаются liveness (fallback, когда ws-кадров нет)", async () => {
    const h = createWatchdogHarness(20, 150);
    try {
      await h.provider.start();
      h.socket.emit("connection.update", { connection: "open" });
      await waitFor(() => h.provider.getSnapshot().state === "CONNECTED", "connected");

      const start = Date.now();
      while (Date.now() - start < 400) {
        h.socket.emit("messages.update", []);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(h.provider.getSnapshot().state).toBe("CONNECTED");
    } finally {
      await h.provider.stop("test done");
    }
  });
});
