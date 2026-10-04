/**
 * Baileys 6.7.24 runtime loader (M2, A-25).
 *
 * Импорт выполняется через `new Function(...)` вместо статического
 * `import`/`require`: пакет — pure ESM ("type": "module"), а backend-код
 * компилируется в CommonJS. Статический import() на уровне TS превращается
 * в require-хелпер, который не умеет загружать ESM; сохранённый через
 * new Function настоящий dynamic import() работает и на Node 22.12+
 * (require(esm)), и на Node 24.
 *
 * Baileys импортируется ТОЛЬКО здесь (валидация реального подключения
 * smoke-тестом); весь остальной код знает лишь структурные интерфейсы
 * ниже — бизнес-слой и whatsapp-домен напрямую от Baileys не зависят.
 */

/**
 * Signal key store (Baileys `SignalKeyStore`): batch-get по списку id,
 * bulk-set (null = удалить ключ). Значения — Uint8Array/объекты с
 * Uint8Array внутри; JSON-безопасное кодирование делает адаптер через
 * BufferJSON (см. baileys-auth-adapter.ts).
 */
export interface BaileysKeyStoreLike {
  get(type: string, ids: string[]): Promise<Record<string, unknown>>;
  set(data: Record<string, Record<string, unknown | null>>): Promise<void>;
}

export interface BaileysConnectionUpdateLike {
  connection?: "open" | "close";
  qr?: string;
  lastDisconnect?: { error?: Error; date?: Date };
}

export interface BaileysMessageKeyLike {
  id?: string;
  remoteJid?: string | null;
  fromMe?: boolean;
  participant?: string | null;
  /** Baileys WAMessageKey: LID/PN-идентификаторы отправителя (§10). */
  senderLid?: string | null;
  senderPn?: string | null;
  participantLid?: string | null;
  participantPn?: string | null;
}

export interface BaileysMessageLike {
  key: BaileysMessageKeyLike;
  message?: Record<string, unknown> | null;
  messageTimestamp?: number | LongLike;
  pushName?: string | null;
}

interface LongLike {
  toNumber?: () => number;
  low?: number;
}

export interface BaileysMessageUpdateLike {
  key: BaileysMessageKeyLike;
  update?: { status?: number | LongLike };
}

export interface BaileysContactLike {
  id?: string | null;
  lid?: string | null;
  jid?: string | null;
}

export interface BaileysEventEmitterLike {
  on(event: "connection.update", cb: (update: BaileysConnectionUpdateLike) => void): void;
  on(event: "creds.update", cb: (update: Record<string, unknown>) => void): void;
  on(event: "messages.upsert", cb: (upsert: { messages: BaileysMessageLike[]; type: string }) => void): void;
  on(event: "messages.update", cb: (updates: BaileysMessageUpdateLike[]) => void): void;
  on(event: "contacts.upsert", cb: (contacts: BaileysContactLike[]) => void): void;
  on(event: "chats.phoneNumberShare", cb: (data: { lid?: string | null; jid?: string | null }) => void): void;
  removeAllListeners?(): void;
}

export interface BaileysSocketLike {
  ev: BaileysEventEmitterLike;
  user?: { id?: string; name?: string } | null;
  relayMessage(jid: string, content: Record<string, unknown>, options: { messageId: string }): Promise<void>;
  /** Отправка медиа (M3+: generateWAMessage + relay внутри Baileys). */
  sendMessage?(
    jid: string,
    content: Record<string, unknown>,
    options: { messageId: string },
  ): Promise<unknown>;
  /** Re-upload медиа после сбоя скачивания (downloadMediaMessage ctx). */
  updateMediaMessage?(message: unknown): Promise<unknown>;
  /** pn→lid проверка (USync); отсутствует на test-fakes. */
  onWhatsApp?(...jids: string[]): Promise<Array<{ jid: string; exists: boolean; lid?: string | null }>>;
  logout?(): Promise<void>;
  end?(error?: unknown): void;
}

/** Базовый pino-like логгер (Baileys принимает ILogger). */
export interface BaileysLoggerLike {
  level: string;
  child(bindings: Record<string, unknown>): BaileysLoggerLike;
  trace(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fatal(...args: unknown[]): void;
}

export interface BaileysBufferJsonLike {
  replacer(key: string, value: unknown): unknown;
  reviver(key: string, value: unknown): unknown;
}

/**
 * Минимальная структурная карта экспорта @whiskeysockets/baileys@6.7.24 —
 * только то, что использует BaileysWhatsAppProvider.
 */
export interface BaileysModuleLike {
  makeWASocket(config: Record<string, unknown>): BaileysSocketLike;
  initAuthCreds(): Record<string, unknown>;
  makeCacheableSignalKeyStore(store: BaileysKeyStoreLike, logger: BaileysLoggerLike): BaileysKeyStoreLike;
  /** Bidirectional map: { 401: 'loggedOut', ..., loggedOut: 401 }. */
  DisconnectReason: Record<string, string | number>;
  BufferJSON: BaileysBufferJsonLike;
  Browsers: { ubuntu(browser: string): [string, string, string] };
  /** Скачивание входящего медиа (M3+ файлы); отсутствует на test-stub. */
  downloadMediaMessage?(
    message: unknown,
    type: "buffer",
    options: Record<string, unknown>,
    context?: { reuploadRequest?: (msg: unknown) => Promise<unknown>; logger?: unknown },
  ): Promise<Uint8Array>;
}

/** Настоящий dynamic import ESM-пакета (см. комментарий модуля выше). */
export async function loadBaileys(): Promise<BaileysModuleLike> {
  const dynamicImport = new Function("m", "return import(m)") as (specifier: string) => Promise<unknown>;
  const module: unknown = await dynamicImport("@whiskeysockets/baileys");
  return module as BaileysModuleLike;
}
