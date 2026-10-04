import { AuthStateStore } from "./auth-state-store";
import type { BaileysBufferJsonLike, BaileysKeyStoreLike } from "./baileys-loader";

/**
 * M2: адаптер AuthStateStore ⇄ Baileys AuthenticationState (§6.3/§6.7).
 *
 *  - creds/keys живут в памяти как у Baileys; персист — через AuthStateStore
 *    (AES-256-GCM, crash-safe, writer queue) с fencing-токеном lease;
 *  - кодирование значений — BufferJSON (Uint8Array ⇄ base64), чтобы
 *    зашифрованный JSON-документ был валиден;
 *  - записи асинхронны с debounce (flush при остановке/рестарте сессии);
 *    cancelPending() отменяет отложенную запись при уничтожении сессии;
 *  - load()-ошибки (corrupt/key_mismatch/integrity) НЕ обрабатываются здесь:
 *    их поднимает провайдер → ERROR без auto-reset (ручной session-reset).
 */

export interface BaileysAuthAdapterOptions {
  readonly store: AuthStateStore;
  /** Fencing-токен текущего lease (отсекает записи потерявшего аренду). */
  readonly getFencingToken: () => number;
  /** Свежая пара ключей Baileys (initAuthCreds) для первой сессии. */
  readonly freshCreds: () => Record<string, unknown>;
  readonly bufferJson: BaileysBufferJsonLike;
  /** Debounce персиста после записи от Baileys (default 500ms). */
  readonly persistDebounceMs?: number;
}

const DEFAULT_PERSIST_DEBOUNCE_MS = 500;

export class BaileysAuthAdapter {
  private readonly store: AuthStateStore;
  private readonly getFencingToken: () => number;
  private readonly bufferJson: BaileysBufferJsonLike;
  private readonly persistDebounceMs: number;
  private creds: Record<string, unknown>;
  private readonly keys: Record<string, Record<string, unknown>> = {};
  private persistTimer: NodeJS.Timeout | null = null;
  private lastPersistError: unknown = null;
  /** true — creds/keys менялись после последнего flush (нужен persist до reload). */
  private dirty = false;
  /** false — на диске не было сессии (fresh pair → провайдер ждёт QR). */
  readonly loadedExistingSession: boolean;

  private constructor(options: BaileysAuthAdapterOptions, loaded: { creds: Record<string, unknown>; keys: Record<string, Record<string, unknown>> } | null) {
    this.store = options.store;
    this.getFencingToken = options.getFencingToken;
    this.bufferJson = options.bufferJson;
    this.persistDebounceMs = options.persistDebounceMs ?? DEFAULT_PERSIST_DEBOUNCE_MS;
    this.loadedExistingSession = loaded !== null;
    if (loaded) {
      // На диске creds лежат в BufferJSON-коде (Uint8Array ⇄ base64):
      // декодируем в «живые» типы, которые ожидает Baileys.
      this.creds = this.decodeJson(loaded.creds);
      for (const [type, entries] of Object.entries(loaded.keys)) this.keys[type] = { ...entries };
    } else {
      this.creds = options.freshCreds();
    }
  }

  /**
   * Загрузка из AuthStateStore. WhatsAppAuthStateError (corrupt/integrity/
   * key_mismatch/missing_key) пробрасывается без какого-либо auto-reset.
   */
  static async create(options: BaileysAuthAdapterOptions): Promise<BaileysAuthAdapter> {
    const doc = await options.store.load();
    return new BaileysAuthAdapter(
      options,
      doc ? { creds: doc.creds, keys: doc.keys as Record<string, Record<string, unknown>> } : null,
    );
  }

  /** Текущий объект creds (Baileys мутирует через creds.update события). */
  get credentials(): Record<string, unknown> {
    return this.creds;
  }

  /** Baileys `auth.keys` (batch get / bulk set). */
  readonly keyStore: BaileysKeyStoreLike = {
    get: async (type: string, ids: string[]): Promise<Record<string, unknown>> => {
      const result: Record<string, unknown> = {};
      const bucket = this.keys[type];
      if (!bucket) return result;
      for (const id of ids) {
        const raw = bucket[id];
        if (raw !== undefined) result[id] = this.decode(raw);
      }
      return result;
    },
    set: async (data: Record<string, Record<string, unknown | null>>): Promise<void> => {
      for (const [type, entries] of Object.entries(data)) {
        for (const [id, value] of Object.entries(entries)) {
          const bucket = (this.keys[type] ??= {});
          if (value === null || value === undefined) delete bucket[id];
          else bucket[id] = this.encode(value);
        }
      }
      this.dirty = true;
      this.schedulePersist();
    },
  };

  /** Handler для Baileys-события `creds.update`. */
  readonly saveCreds = (update?: Record<string, unknown>): void => {
    if (update) Object.assign(this.creds, update);
    this.dirty = true;
    this.schedulePersist();
  };

  /** Есть ли неперсистённые изменения (pairing-creds могли ещё не упасть на диск). */
  get isDirty(): boolean {
    return this.dirty;
  }

  /** Отменить отложенную запись — сессия уничтожается, писать уже нельзя. */
  cancelPending(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  /** Debounced запись через AuthStateStore (fencing-проверка внутри). */
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flush().catch((error: unknown) => {
        this.lastPersistError = error;
        console.error("[whatsapp] auth-state persist failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    }, this.persistDebounceMs);
    this.persistTimer.unref?.();
  }

  /** Немедленная синхронная запись (остановка сессии / перед закрытием). */
  async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    // Creds переживают restart только в BufferJSON-коде (Uint8Array полей).
    await this.store.save({ creds: this.encodeJson(this.creds), keys: this.keys }, this.getFencingToken());
    this.dirty = false;
    this.lastPersistError = null;
  }

  /** Последняя ошибка отложенной записи (диагностика). */
  get pendingPersistError(): unknown {
    return this.lastPersistError;
  }

  private encode(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value, this.bufferJson.replacer));
  }

  private decode(raw: unknown): unknown {
    return JSON.parse(JSON.stringify(raw), this.bufferJson.reviver);
  }

  private encodeJson(value: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value, this.bufferJson.replacer));
  }

  private decodeJson(value: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value), this.bufferJson.reviver);
  }
}
