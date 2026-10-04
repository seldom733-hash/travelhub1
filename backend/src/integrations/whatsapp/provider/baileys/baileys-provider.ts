import { AuthStateStore } from "./auth-state-store";
import { BaileysAuthAdapter } from "./baileys-auth-adapter";
import {
  loadBaileys,
  type BaileysConnectionUpdateLike,
  type BaileysContactLike,
  type BaileysMessageLike,
  type BaileysMessageUpdateLike,
  type BaileysModuleLike,
  type BaileysSocketLike,
} from "./baileys-loader";
import type { WhatsAppConfig } from "../../whatsapp.config";
import {
  assertTransition,
  stateAfterDisconnect,
  canAutoReconnect,
  type WhatsAppDisconnectReason,
} from "../../state/connection-state.machine";
import type { WhatsAppConnectionState } from "../../../../generated/prisma/enums";
import { WhatsAppNotConnectedError, WhatsAppMessageSendError } from "../whatsapp-errors";
import type {
  WhatsAppConnectionSnapshot,
  WhatsAppDeliveryUpdate,
  WhatsAppInboundProviderMessage,
  WhatsAppProvider,
  WhatsAppReconcileResult,
  WhatsAppSendCommand,
  WhatsAppSendResult,
  Unsubscribe,
} from "../whatsapp-provider";

type WhatsAppConnectionStateName = WhatsAppConnectionState;
type WhatsAppDeliveryStatus = WhatsAppDeliveryUpdate["status"];

/**
 * M2: реальный Baileys-провайдер (@whiskeysockets/baileys@6.7.24).
 *
 *  - сокет создаётся ТОЛЬКО здесь через loader (единственный импорт Baileys);
 *  - auth-state — AuthStateStore (AES-256-GCM + fencing, §6.3/§6.7);
 *  - состояния §6.2 через connection-state.machine (LOGGED_OUT при удалённом
 *    logout); QR живёт только в памяти snapshot;
 *  - reconnect: только network/restartRequired, экспоненциальный backoff
 *    (WHATSAPP_RECONNECT_*), не больше WHATSAPP_MAX_RECONNECT_ATTEMPTS;
 *  - гонка «QR отсканирован → restartRequired(515) → reconnect»: pairing-creds
 *    персилятся (flushDirtyAdapter) ДО поднятия нового сокета, старый сокет
 *    отвязывается (listeners + end) — без «зомби»-сокета с теми же creds;
 *  - loggedOut (401) → LOGGED_OUT + АВТО-уничтожение локальной сессии (wipe)
 *    с перезапуском в свежий QR — без ручного session-reset (цикл невозможен:
 *    без creds сервер выдаёт QR, а не 401);
 *  - send: relayMessage с нашим providerMessageId (D6), таймаут/разрыв во
 *    время send → ambiguous (UNKNOWN, at-most-once);
 *  - reconcile: evidence из receipts/echo текущей сессии (монотонный
 *    sent < delivered < read);
 *  - история синхронизации выключена (WHATSAPP_IMPORT_HISTORY=false, v1).
 */

type Listener<T> = (value: T) => void;

interface BaileysSilentLogger {
  level: string;
  child(): BaileysSilentLogger;
  trace(): void;
  debug(): void;
  info(): void;
  warn(): void;
  error(): void;
  fatal(): void;
}

const SILENT_LOGGER: BaileysSilentLogger = {
  level: "silent",
  child: () => SILENT_LOGGER,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
};

class SendTimeoutMarker extends Error {
  constructor(timeoutMs: number) {
    super(`WhatsApp send timed out after ${timeoutMs}ms`);
    this.name = "SendTimeoutMarker";
  }
}

const EVIDENCE_RANK: Record<WhatsAppDeliveryStatus, number> = { sent: 1, delivered: 2, read: 3 };

/** LID→pn резолв (USync) — таймаут одного запроса. */
const LID_RESOLVE_TIMEOUT_MS = 4_000;
/** Повтор неудавшегося lid-резолва (отрицательный кеш). */
const LID_RETRY_MS = 5 * 60_000;
/** Размер чанка pn-кандидатов в одном onWhatsApp-запросе. */
const PHONE_PROBE_CHUNK = 50;
/** Таймаут скачивания входящего медиа. */
const MEDIA_DOWNLOAD_TIMEOUT_MS = 30_000;
/** Типы сообщений, у которых есть файл для скачивания. */
const MEDIA_TYPES: ReadonlySet<WhatsAppInboundProviderMessage["type"]> = new Set([
  "image",
  "video",
  "audio",
  "document",
  "sticker",
]);

/** `99450…@s.whatsapp.net` / `99450…:4@…` / `+99450…` / голые цифры → E.164. */
function jidDigitsToE164(value: string): string | null {
  const bare = value.split("@")[0].split(":")[0].replace(/^\+/, "");
  return /^\d{7,15}$/.test(bare) ? `+${bare}` : null;
}

export interface BaileysProviderOptions {
  readonly config: WhatsAppConfig;
  /** Идентификатор инстанса (lease owner candidate). */
  readonly instanceId: string;
  /** Fencing-токен текущего lease (для записей auth-state). */
  readonly getFencingToken: () => number;
  /** Инъекция сокета для unit-тестов (по умолчанию module.makeWASocket). */
  readonly socketStarter?: (module: BaileysModuleLike, auth: { creds: Record<string, unknown>; keys: BaileysAuthAdapter["keyStore"] }) => BaileysSocketLike;
  /**
   * Инъекция загрузчика Baileys для unit-тестов (в jest-vm нативный
   * import() заблокирован без --experimental-vm-modules); в проде —
   * loadBaileys().
   */
  readonly loadModule?: () => Promise<BaileysModuleLike>;
}

function extractStatusCode(error?: Error): number | null {
  const e = error as unknown as
    | { output?: { statusCode?: unknown }; statusCode?: unknown; code?: unknown }
    | undefined;
  const candidates = [e?.output?.statusCode, e?.statusCode, e?.code];
  for (const candidate of candidates) {
    if (typeof candidate === "number") return candidate;
  }
  return null;
}

/** Baileys DisconnectReason (числовой код) → причина §6.2; null → unknown. */
export function mapDisconnectReason(code: number | null): WhatsAppDisconnectReason {
  switch (code) {
    case 401: // loggedOut
      return "loggedOut";
    case 440: // connectionReplaced
      return "connectionReplaced";
    case 403: // forbidden
    case 411: // multideviceMismatch
    case 500: // badSession
      return "authFailure";
    case 515: // restartRequired
      return "restartRequired";
    case 428: // connectionClosed
    case 408: // connectionLost/timedOut
    case 503: // unavailableService
      return "network";
    default:
      // R6: неизвестные причины НЕ угадываются.
      return "unknown";
  }
}

interface ExtractedMediaMeta {
  readonly filename: string | null;
  readonly mimetype: string | null;
  readonly size: number | null;
}

interface ExtractedMessageMeta {
  readonly text: string | null;
  readonly type: WhatsAppInboundProviderMessage["type"];
  readonly media: ExtractedMediaMeta | null;
}

/** fileLength приходит Long-подобным ({low,toNumber}) или number. */
function fileSizeOf(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const longLike = value as { toNumber?: () => number; low?: number };
    if (typeof longLike.toNumber === "function") return longLike.toNumber();
    if (typeof longLike.low === "number") return longLike.low;
  }
  return null;
}

function extractMessageMeta(message: Record<string, unknown>): ExtractedMessageMeta {
  if (typeof message["conversation"] === "string") return { text: message["conversation"], type: "text", media: null };
  const ext = message["extendedTextMessage"] as { text?: unknown } | undefined;
  if (ext && typeof ext.text === "string") return { text: ext.text, type: "text", media: null };
  for (const key of ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"] as const) {
    const media = message[key] as
      | { caption?: unknown; mimetype?: unknown; fileLength?: unknown; fileName?: unknown }
      | undefined;
    if (!media) continue;
    const type = key.replace("Message", "") as WhatsAppInboundProviderMessage["type"];
    const text = typeof media.caption === "string" && media.caption.length > 0 ? media.caption : null;
    return {
      text,
      type,
      media: {
        filename: key === "documentMessage" && typeof media.fileName === "string" ? media.fileName : null,
        mimetype: typeof media.mimetype === "string" ? media.mimetype : null,
        size: fileSizeOf(media.fileLength),
      },
    };
  }
  return { text: null, type: "other", media: null };
}

function timestampToMs(value: unknown): Date {
  if (typeof value === "number") return new Date(value * 1000);
  if (value && typeof value === "object") {
    const longLike = value as { toNumber?: () => number; low?: number };
    if (typeof longLike.toNumber === "function") return new Date(longLike.toNumber() * 1000);
    if (typeof longLike.low === "number") return new Date(longLike.low * 1000);
  }
  return new Date();
}

export class BaileysWhatsAppProvider implements WhatsAppProvider {
  readonly capabilities = {
    qrPairing: true,
    deliveryReceipts: true,
    media: ["document"] as readonly ("image" | "video" | "audio" | "document" | "sticker")[],
    requiresSessionOwnership: true,
    requiresApprovedTemplates: false,
  } as const;

  private readonly config: WhatsAppConfig;
  private readonly instanceId: string;
  private readonly getFencingToken: () => number;
  private readonly socketStarter?: BaileysProviderOptions["socketStarter"];
  private readonly loadModule: () => Promise<BaileysModuleLike>;
  private readonly authStore: AuthStateStore;

  private state: WhatsAppConnectionStateName = "DISCONNECTED";
  private phone: string | null = null;
  private connectedAt: Date | null = null;
  private qr: string | null = null;
  private lastError: string | null = null;

  private module: BaileysModuleLike | null = null;
  private adapter: BaileysAuthAdapter | null = null;
  private socket: BaileysSocketLike | null = null;
  private startPromise: Promise<void> | null = null;
  private stopping = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  private readonly evidence = new Map<string, { status: WhatsAppDeliveryStatus; observedAt: Date }>();
  private readonly stateListeners = new Set<Listener<WhatsAppConnectionSnapshot>>();
  private readonly inboundListeners = new Set<Listener<WhatsAppInboundProviderMessage>>();
  private readonly deliveryListeners = new Set<Listener<WhatsAppDeliveryUpdate>>();
  /** Кеш lidJid → pn (canonical E.164): send-probe/contacts/phoneNumberShare/CRM. */
  private readonly lidCache = new Map<string, string>();
  /** Момент последней неудачной резолции lid (ретрай через LID_RETRY_MS). */
  private readonly lidMissAt = new Map<string, number>();

  constructor(options: BaileysProviderOptions) {
    this.config = options.config;
    this.instanceId = options.instanceId;
    this.getFencingToken = options.getFencingToken;
    this.socketStarter = options.socketStarter;
    this.loadModule = options.loadModule ?? loadBaileys;
    this.authStore = new AuthStateStore({
      sessionPath: options.config.sessionPath,
      encryptionKeyMaterial: options.config.authEncryptionKey,
    });
  }

  getSnapshot(): WhatsAppConnectionSnapshot {
    return {
      state: this.state,
      phone: this.phone,
      connectedAt: this.connectedAt,
      qr: this.qr,
      lastError: this.lastError,
      instanceId: this.instanceId,
    };
  }

  onStateChange(listener: Listener<WhatsAppConnectionSnapshot>): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onInbound(listener: Listener<WhatsAppInboundProviderMessage>): Unsubscribe {
    this.inboundListeners.add(listener);
    return () => this.inboundListeners.delete(listener);
  }

  onDeliveryUpdate(listener: Listener<WhatsAppDeliveryUpdate>): Unsubscribe {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  /** Инициализация/запуск. Идемпотентен относительно конкурентных вызовов. */
  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    if (this.state === "CONNECTING" || this.state === "QR_REQUIRED" || this.state === "CONNECTED") return;
    this.startPromise = this.doStart();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async doStart(): Promise<void> {
    this.cancelReconnectTimer();
    this.stopping = false;
    if (this.state === "RECONNECTING") this.transition("DISCONNECTED");
    if (this.state === "DISCONNECTED" || this.state === "ERROR" || this.state === "LOGGED_OUT") {
      this.transition("INITIALIZING");
    }
    try {
      // Гонка 515: «грязные» pairing-creds старого адаптера — на диск ДО того,
      // как новый адаптер прочитает сессию из store (reload без 401-цикла).
      await this.flushDirtyAdapter();
      if (!this.module) this.module = await this.loadModule();
      this.adapter = await BaileysAuthAdapter.create({
        store: this.authStore,
        getFencingToken: this.getFencingToken,
        freshCreds: this.module.initAuthCreds,
        bufferJson: this.module.BufferJSON,
      });
      // Рекомендация Baileys: кеширующая обёртка над signal key store.
      const keys = this.module.makeCacheableSignalKeyStore(this.adapter.keyStore, SILENT_LOGGER);
      const auth = { creds: this.adapter.credentials, keys };
      this.socket = this.socketStarter
        ? this.socketStarter(this.module, auth)
        : this.module.makeWASocket({
            auth,
            logger: SILENT_LOGGER,
            browser: this.module.Browsers.ubuntu("Chrome"),
            markOnlineOnConnect: false,
            syncFullHistory: false,
            // WHATSAPP_IMPORT_HISTORY=false (v1): Baileys НЕ запрашивает историю.
            shouldSyncHistoryMessage: () => false,
            generateHighQualityLinkPreview: false,
          });
      this.wireEvents(this.socket);
      // §6.2: свежая сессия ждёт QR (INITIALIZING → QR_REQUIRED), существующая
      // сразу идёт CONNECTING → CONNECTED.
      if (this.state === "INITIALIZING" && this.adapter.loadedExistingSession) {
        this.transition("CONNECTING");
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "failed to start WhatsApp socket";
      if (this.state === "INITIALIZING" || this.state === "CONNECTING" || this.state === "QR_REQUIRED") {
        this.transition("ERROR");
      }
      throw error;
    }
  }

  private wireEvents(socket: BaileysSocketLike): void {
    socket.ev.on("creds.update", (update: Record<string, unknown>) => {
      this.adapter?.saveCreds(update);
    });
    socket.ev.on("connection.update", (update) => this.onConnectionUpdate(update));
    socket.ev.on("messages.upsert", (upsert) => this.onMessagesUpsert(upsert.messages));
    socket.ev.on("messages.update", (updates) => this.onMessagesUpdate(updates));
    socket.ev.on("contacts.upsert", (contacts) => this.onContactsUpsert(contacts));
    socket.ev.on("chats.phoneNumberShare", (data) => this.onPhoneNumberShare(data));
  }

  private onConnectionUpdate(update: BaileysConnectionUpdateLike): void {
    if (this.stopping) return;
    try {
      if (update.qr && this.state !== "CONNECTED") {
        // QR хранится ТОЛЬКО в памяти (не в БД, не в логах).
        this.qr = update.qr;
        if (this.state !== "QR_REQUIRED") this.transition("QR_REQUIRED");
      }
      if (update.connection === "open") {
        this.qr = null;
        this.lastError = null;
        if (this.state === "INITIALIZING") this.transition("CONNECTING");
        if (this.state === "QR_REQUIRED") this.transition("CONNECTING");
        if (this.state === "CONNECTING") this.transition("CONNECTED");
        this.connectedAt = new Date();
        this.phone = this.parsePhone(this.socket?.user?.id);
        this.reconnectAttempts = 0;
      } else if (update.connection === "close") {
        void this.handleClose(update.lastDisconnect?.error);
      }
    } catch (error) {
      console.error("[whatsapp] connection.update handling failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async handleClose(error?: Error): Promise<void> {
    if (this.stopping) return;
    if (this.state === "DISCONNECTED" || this.state === "LOGGING_OUT") return;
    const code = extractStatusCode(error);
    const reason = mapDisconnectReason(code);
    this.lastError = `connection closed (${reason}${code !== null ? `, code ${code}` : ""})`;
    try {
      const target = stateAfterDisconnect(reason);
      if (this.state === target) return;
      // Сервер уже закрыл сокет: снимаем listeners и закрываем best-effort —
      // иначе рестарт (515) оставляет «зомби»-сокет с теми же creds.
      this.detachSocket();
      // RECONNECTING достижимо только из CONNECTED (таблица §6.2); разрыв
      // во время handshake — в DISCONNECTED с тем же auto-reconnect.
      if (target === "RECONNECTING" && this.state !== "CONNECTED") {
        this.transition("DISCONNECTED");
        if (canAutoReconnect(reason)) this.scheduleReconnect();
        return;
      }
      this.transition(target); // LOGGED_OUT | ERROR | RECONNECTING
      if (target === "LOGGED_OUT") {
        // Сервер отверг сессию (401) → уничтожаем локальную и сразу
        // перезапускаемся в свежий QR (без ручного session-reset).
        void this.destroyDeadSession();
      } else if (target === "RECONNECTING") {
        if (canAutoReconnect(reason)) this.scheduleReconnect();
        else if (!this.config.reconnectEnabled) this.transition("ERROR");
      }
    } catch (error2) {
      console.error("[whatsapp] disconnect handling failed", {
        error: error2 instanceof Error ? error2.message : "unknown",
      });
    }
  }

  /** Отвязать закрытый сервером сокет: снять listeners, закрыть best-effort. */
  private detachSocket(): void {
    if (!this.socket) return;
    this.socket.ev.removeAllListeners?.();
    try {
      this.socket.end?.();
    } catch {
      // Закрытие сокета best-effort.
    }
    this.socket = null;
  }

  /** Персист «грязных» pairing-creds старого адаптера перед пересозданием сокета. */
  private async flushDirtyAdapter(): Promise<void> {
    if (!this.adapter || !this.adapter.isDirty) return;
    try {
      await this.adapter.flush();
    } catch (error) {
      console.error("[whatsapp] auth-state flush before restart failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  /**
   * Неудачная авторизация (loggedOut/401): локальная сессия мертва на сервере.
   * Автоматически уничтожаем её (отмена отложенной записи + wipe + сброс
   * памяти) и перезапускаем провайдер → UI сразу получает свежий QR.
   * Цикл невозможен: без creds сервер не отвечает 401, а выдаёт QR.
   */
  private async destroyDeadSession(): Promise<void> {
    try {
      this.adapter?.cancelPending(); // отложенная запись не воскресит мёртвые creds
      this.adapter = null;
      this.qr = null;
      this.phone = null;
      this.connectedAt = null;
      this.evidence.clear();
      await this.authStore.wipe(this.getFencingToken());
      if (this.stopping) return;
      await this.start(); // LOGGED_OUT → INITIALIZING: свежая сессия ждёт QR
    } catch (error) {
      console.error("[whatsapp] dead session destroy failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private scheduleReconnect(): void {
    if (!this.config.reconnectEnabled || this.stopping) {
      if (this.state === "RECONNECTING") this.transition("ERROR");
      return;
    }
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.lastError = `max reconnect attempts reached (${this.config.maxReconnectAttempts})`;
      if (this.state === "RECONNECTING") this.transition("ERROR");
      return;
    }
    const delay = Math.min(
      this.config.reconnectBaseDelayMs * 2 ** this.reconnectAttempts,
      this.config.reconnectMaxDelayMs,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopping) return;
      if (this.state !== "RECONNECTING" && this.state !== "DISCONNECTED") return;
      void this.start().catch((error: unknown) => {
        this.lastError = error instanceof Error ? error.message : "reconnect failed";
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  private cancelReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private onMessagesUpsert(messages: BaileysMessageLike[]): void {
    for (const message of messages) {
      const id = message.key.id;
      if (!id) continue;
      const meta = message.message
        ? extractMessageMeta(message.message)
        : { text: null, type: "other" as const, media: null };
      const inbound: WhatsAppInboundProviderMessage = {
        providerMessageId: id,
        remoteJid: message.key.remoteJid ?? "",
        fromMe: message.key.fromMe === true,
        participant: message.key.participant ?? null,
        occurredAt: timestampToMs(message.messageTimestamp),
        type: meta.type,
        text: meta.text,
        lid: message.key.senderLid ?? message.key.participantLid ?? null,
        senderPn: message.key.senderPn ?? message.key.participantPn ?? null,
        media: meta.media ? { ...meta.media, bytes: null } : null,
      };
      if (message.key.fromMe) {
        // M3 §8: echo — evidence «sent» ДЛЯ Reconcile + событие в inbound-
        // пайплайн (корреляция с известным outbound / запись «вне HUB»);
        // вторая копия Communication не создаётся (dedup по providerMessageId).
        this.recordEvidence(id, "sent");
      }
      if (meta.media && MEDIA_TYPES.has(meta.type)) {
        this.enqueueMediaInbound(inbound, message);
        continue;
      }
      // LID-адресация: stanza pn не приходит — подставляем pn из кеша
      // (send-probe/contacts/phoneNumberShare); иначе остаётся как есть.
      this.emitInbound(this.withCachedLidPn(inbound));
    }
  }

  /**
   * M3+: скачивание медиа — медленная операция; цепочка сохраняет порядок
   * между медиа-сообщениями (текст эмитится синхронно — таймлайн сортирует
   * по occurredAt, гонка эмиссий допустима).
   */
  private mediaEmitChain: Promise<void> = Promise.resolve();

  private enqueueMediaInbound(inbound: WhatsAppInboundProviderMessage, raw: BaileysMessageLike): void {
    this.mediaEmitChain = this.mediaEmitChain
      .then(async () => {
        const bytes = await this.downloadMediaBytes(raw);
        this.emitInbound(
          this.withCachedLidPn({
            ...inbound,
            media: inbound.media ? { ...inbound.media, bytes } : null,
          }),
        );
      })
      .catch(() => undefined);
  }

  private async downloadMediaBytes(raw: BaileysMessageLike): Promise<Uint8Array | null> {
    const module = this.module;
    if (!module?.downloadMediaMessage) return null;
    const socket = this.socket;
    try {
      return await this.withTimeout(
        module.downloadMediaMessage(raw, "buffer", {}, {
          reuploadRequest: async (msg: unknown) =>
            socket?.updateMediaMessage ? socket.updateMediaMessage(msg) : msg,
          logger: SILENT_LOGGER,
        }),
        MEDIA_DOWNLOAD_TIMEOUT_MS,
        "media download",
      );
    } catch (error) {
      console.warn("[whatsapp] media download failed", {
        id: raw.key.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Кеш lidJid → pn (E.164): заполняет senderPn для lid-диалогов. */
  private withCachedLidPn(message: WhatsAppInboundProviderMessage): WhatsAppInboundProviderMessage {
    if (message.senderPn || !message.remoteJid.endsWith("@lid")) return message;
    const cached = this.lidCache.get(message.remoteJid);
    return cached ? { ...message, senderPn: cached } : message;
  }

  private emitInbound(message: WhatsAppInboundProviderMessage): void {
    for (const listener of this.inboundListeners) listener(message);
  }

  /**
   * §10 lid→pn по кандидатам: onWhatsApp (pn→lid) сверяется с lidJid.
   * Источник кандидатов — вызывающий (CRM-скан); неудача кешируется на
   * LID_RETRY_MS, чтобы не долбить USync на каждом сообщении.
   */
  async findPhoneByLid(lidJid: string, candidatePhones: string[]): Promise<string | null> {
    const cached = this.lidCache.get(lidJid);
    if (cached) return cached;
    const missedAt = this.lidMissAt.get(lidJid);
    if (missedAt !== undefined && Date.now() - missedAt < LID_RETRY_MS) return null;
    const socket = this.socket;
    if (!socket?.onWhatsApp) return null;
    const bareLid = lidJid.split("@")[0];
    const phones = candidatePhones.filter((phone) => phone.startsWith("+"));
    if (phones.length === 0) return null;
    try {
      for (let i = 0; i < phones.length; i += PHONE_PROBE_CHUNK) {
        const chunk = phones.slice(i, i + PHONE_PROBE_CHUNK);
        const results = await this.withTimeout(socket.onWhatsApp(...chunk), LID_RESOLVE_TIMEOUT_MS);
        for (const entry of results ?? []) {
          const entryLid = typeof entry.lid === "string" ? entry.lid.split("@")[0] : null;
          const entryPn = jidDigitsToE164(entry.jid);
          if (entryLid && entryLid === bareLid && entryPn) {
            this.lidCache.set(lidJid, entryPn);
            this.lidMissAt.delete(lidJid);
            console.log("[whatsapp] lid→phone resolved", { lid: lidJid, pn: entryPn });
            return entryPn;
          }
        }
      }
      this.lidMissAt.set(lidJid, Date.now());
      return null;
    } catch (error) {
      console.error("[whatsapp] lid→phone probe failed", {
        lid: lidJid,
        error: error instanceof Error ? error.message : "unknown",
      });
      this.lidMissAt.set(lidJid, Date.now());
      return null;
    }
  }

  /** После успешного send: pn→lid (onWhatsApp) пополняет кеш для ответов. */
  private async probePhoneLid(recipientJid: string): Promise<void> {
    if (!recipientJid.endsWith("@s.whatsapp.net")) return;
    const pnE164 = jidDigitsToE164(recipientJid);
    const socket = this.socket;
    if (!pnE164 || !socket?.onWhatsApp) return;
    try {
      const results = await this.withTimeout(socket.onWhatsApp(pnE164), LID_RESOLVE_TIMEOUT_MS);
      const rawLid = results?.[0]?.lid;
      if (typeof rawLid !== "string" || rawLid.length === 0) return;
      const lidDigits = rawLid.split("@")[0];
      if (!/^\d+$/.test(lidDigits)) return;
      const lidJid = `${lidDigits}@lid`;
      this.lidCache.set(lidJid, pnE164);
      this.lidMissAt.delete(lidJid);
      console.log("[whatsapp] phone→lid cached", { pn: pnE164, lid: lidJid });
    } catch (error) {
      console.error("[whatsapp] phone→lid probe failed", {
        pn: pnE164,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  /** Пассивное обогащение кеша: contacts.upsert несёт пары lid↔jid. */
  private onContactsUpsert(contacts: BaileysContactLike[]): void {
    for (const contact of contacts) {
      const lid = typeof contact.lid === "string" ? contact.lid : null;
      const jid = typeof contact.jid === "string" ? contact.jid : null;
      const id = typeof contact.id === "string" ? contact.id : null;
      if (lid?.endsWith("@lid") && jid?.endsWith("@s.whatsapp.net")) {
        const pn = jidDigitsToE164(jid);
        if (pn) {
          this.lidCache.set(lid, pn);
          this.lidMissAt.delete(lid);
          console.log("[whatsapp] contact pair cached", { lid, pn });
        }
      }
      if (id?.endsWith("@lid") && jid?.endsWith("@s.whatsapp.net")) {
        const pn = jidDigitsToE164(jid);
        if (pn) {
          this.lidCache.set(id, pn);
          this.lidMissAt.delete(id);
          console.log("[whatsapp] contact pair cached", { lid: id, pn });
        }
      }
    }
  }

  /** Экспlicit share phone number: Baileys даёт {lid, jid} напрямую. */
  private onPhoneNumberShare(data: { lid?: string | null; jid?: string | null }): void {
    const lid = typeof data.lid === "string" ? data.lid : null;
    const jid = typeof data.jid === "string" ? data.jid : null;
    if (!lid?.endsWith("@lid") || !jid) return;
    const pn = jidDigitsToE164(jid);
    if (!pn) return;
    this.lidCache.set(lid, pn);
    this.lidMissAt.delete(lid);
    console.log("[whatsapp] phoneNumberShare cached", { lid, pn });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = "lid resolve"): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private onMessagesUpdate(updates: BaileysMessageUpdateLike[]): void {
    for (const update of updates) {
      const id = update.key.id;
      const status = update.update?.status;
      if (!id || !update.key.fromMe || status === undefined || status === null) continue;
      const numeric = typeof status === "number" ? status : this.toStatusNumber(status);
      const mapped = this.mapWAMessageStatus(numeric);
      if (!mapped) continue;
      this.recordEvidence(id, mapped);
      const delivery: WhatsAppDeliveryUpdate = { providerMessageId: id, status: mapped, occurredAt: new Date() };
      for (const listener of this.deliveryListeners) listener(delivery);
    }
  }

  private toStatusNumber(status: unknown): number | null {
    if (typeof status === "number") return status;
    if (status && typeof status === "object") {
      const longLike = status as { toNumber?: () => number; low?: number };
      if (typeof longLike.toNumber === "function") return longLike.toNumber();
      if (typeof longLike.low === "number") return longLike.low;
    }
    return null;
  }

  /** WAMessageStatus: 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED. */
  private mapWAMessageStatus(value: number | null): WhatsAppDeliveryStatus | null {
    switch (value) {
      case 2:
        return "sent";
      case 3:
        return "delivered";
      case 4:
      case 5:
        return "read";
      default:
        return null;
    }
  }

  private recordEvidence(providerMessageId: string, status: WhatsAppDeliveryStatus): void {
    const existing = this.evidence.get(providerMessageId);
    if (existing && EVIDENCE_RANK[existing.status] >= EVIDENCE_RANK[status]) return;
    this.evidence.set(providerMessageId, { status, observedAt: new Date() });
  }

  async send(command: WhatsAppSendCommand): Promise<WhatsAppSendResult> {
    if (this.state !== "CONNECTED" || !this.socket) {
      throw new WhatsAppNotConnectedError(`WhatsApp is not connected (state=${this.state})`);
    }
    const socket = this.socket;
    const timeoutMs = command.timeoutMs ?? this.config.sendTimeoutMs;
    try {
      await this.sendWithTimeout(() => this.dispatchSend(socket, command), timeoutMs);
    } catch (error) {
      if (error instanceof WhatsAppNotConnectedError || error instanceof WhatsAppMessageSendError) throw error;
      // Разрыв/непредвиденная ошибка после начала send → ambiguous (at-most-once).
      const message = error instanceof Error ? error.message : String(error);
      throw new WhatsAppMessageSendError(`WhatsApp send failed: ${message}`, false, error, true);
    }
    this.recordEvidence(command.messageId, "sent");
    // pn→lid проба (fire-and-forget): ответы собеседника придут с lid-адресом.
    void this.probePhoneLid(command.recipientJid);
    return { providerMessageId: command.messageId, sentAt: new Date() };
  }

  /**
   * M3+: документ уходит через socket.sendMessage (prepareWAMessageMedia +
   * генерация внутри Baileys); наш messageId в options переопределяет
   * сгенерированный → providerMessageId совпадает с operation key (D6) и
   * receipts/echo коррелируются как у текста.
   */
  private async dispatchSend(socket: BaileysSocketLike, command: WhatsAppSendCommand): Promise<void> {
    if (command.media) {
      if (!socket.sendMessage) {
        throw new WhatsAppMessageSendError("WhatsApp media send is not supported by this provider", false);
      }
      const content: Record<string, unknown> = {
        document: command.media.bytes,
        mimetype: command.media.mimetype,
        fileName: command.media.filename,
        ...(command.text ? { caption: command.text } : {}),
      };
      await socket.sendMessage(command.recipientJid, content, { messageId: command.messageId });
      return;
    }
    await socket.relayMessage(
      command.recipientJid,
      { extendedTextMessage: { text: command.text } },
      { messageId: command.messageId },
    );
  }

  private async sendWithTimeout(send: () => Promise<unknown>, timeoutMs: number): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        send(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new SendTimeoutMarker(timeoutMs)), timeoutMs);
          timer.unref?.();
        }),
      ]);
    } catch (error) {
      if (error instanceof SendTimeoutMarker) {
        throw new WhatsAppMessageSendError(
          `WhatsApp send timed out after ${timeoutMs}ms (outcome unknown)`,
          false,
          error,
          true,
        );
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async reconcile(providerMessageId: string): Promise<WhatsAppReconcileResult | null> {
    const observed = this.evidence.get(providerMessageId);
    if (!observed) return null;
    return { status: observed.status, observedAt: observed.observedAt };
  }

  /** Graceful shutdown: сокет закрывается, auth-state сбрасывается на диск. */
  async stop(reason = "shutdown"): Promise<void> {
    this.cancelReconnectTimer();
    const wasActive = !this.stopping;
    this.stopping = true;
    try {
      this.detachSocket();
      if (this.adapter) {
        await this.adapter.flush().catch((error: unknown) => {
          console.error("[whatsapp] auth-state flush on stop failed", {
            reason,
            error: error instanceof Error ? error.message : "unknown",
          });
        });
      }
      if (wasActive && this.state !== "DISCONNECTED") {
        if (this.state !== "LOGGING_OUT") this.transition("LOGGING_OUT");
        this.transition("DISCONNECTED");
      }
    } finally {
      this.stopping = false;
    }
  }

  /** Удалённый logout: сессия уничтожается на сервере и на диске. */
  async logout(): Promise<void> {
    this.cancelReconnectTimer();
    this.stopping = true;
    try {
      if (this.socket) {
        this.socket.ev.removeAllListeners?.();
        try {
          await this.socket.logout?.();
        } catch {
          // Серверный logout best-effort: локальную сессию всё равно стираем.
        }
        try {
          this.socket.end?.();
        } catch {
          // noop
        }
        this.socket = null;
      }
      await this.authStore.wipe(this.getFencingToken());
      this.adapter = null;
      this.qr = null;
      this.phone = null;
      this.connectedAt = null;
      this.evidence.clear();
      if (this.state !== "DISCONNECTED") {
        if (this.state !== "LOGGING_OUT") this.transition("LOGGING_OUT");
        this.transition("DISCONNECTED");
      }
    } finally {
      this.stopping = false;
    }
  }

  private parsePhone(userId: string | undefined): string | null {
    if (!userId) return null;
    const [userPart] = userId.split("@");
    if (!userPart) return null;
    const digits = userPart.split(":")[0] ?? "";
    if (!/^\d{7,15}$/.test(digits)) return null;
    return `+${digits}`;
  }

  private transition(to: WhatsAppConnectionStateName): void {
    if (this.state === to) return;
    assertTransition(this.state, to);
    this.state = to;
    const snapshot = this.getSnapshot();
    for (const listener of this.stateListeners) listener(snapshot);
  }
}
