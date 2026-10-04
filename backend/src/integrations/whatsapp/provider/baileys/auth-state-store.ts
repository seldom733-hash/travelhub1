import * as crypto from "crypto";
import * as fsp from "fs/promises";
import * as path from "path";
import { WhatsAppSessionError } from "../whatsapp-errors";

/**
 * M2: AuthStateStore — персистентное хранилище auth-state (мастер-промпт
 * v2.3 §6.3/§6.7, решение владельца M2):
 *
 *  - AES-256-GCM (key = SHA-256(WHATSAPP_AUTH_ENCRYPTION_KEY)); fail-closed
 *    при отсутствии/коротком ключе — хранилище НЕ создаётся;
 *  - crash-safe запись: temp → fsync → rename (+ fsync каталога, где доступен);
 *  - writer queue: записи сериализуются внутри процесса;
 *  - integrity: GCM auth tag + версия конверта + валидация формы документа;
 *  - fencing token: запись с токеном старее, чем уже записанный на диск
 *    (зомби-инстанс после потери lease), отклоняется;
 *  - повреждённая сессия НЕ сбрасывается автоматически: load() бросает
 *    ошибку, файл не удаляется и не перезаписывается — reset только явный
 *    (wipe через session-reset/logout).
 *
 * Файл не содержит секретов в открытом виде; содержимое НИКОГДА не логируется.
 */

export type WhatsAppAuthStateErrorCode =
  | "missing_key"
  | "key_too_short"
  | "corrupt"
  | "integrity"
  | "key_mismatch"
  | "stale_fencing_token"
  | "io";

/** Ошибка хранилища auth-state. Не retryable (session-уровень). */
export class WhatsAppAuthStateError extends WhatsAppSessionError {
  readonly code: WhatsAppAuthStateErrorCode;

  constructor(code: WhatsAppAuthStateErrorCode, message: string, cause?: unknown) {
    super(message, cause);
    this.name = "WhatsAppAuthStateError";
    this.code = code;
  }
}

/** Документ auth-state (creds + signal keys) — generic, без типов Baileys. */
export interface AuthDocument {
  creds: Record<string, unknown>;
  keys: Record<string, unknown>;
  fencingToken: number;
}

export interface AuthStateStoreOptions {
  /** Каталог persistent volume (WHATSAPP_SESSION_PATH). */
  readonly sessionPath: string;
  /** Материал ключа из WHATSAPP_AUTH_ENCRYPTION_KEY (fail-closed < 32). */
  readonly encryptionKeyMaterial: string;
  /** Имя файла внутри каталога (тесты могут переопределять). */
  readonly fileName?: string;
}

interface AuthEnvelope {
  v: number;
  keyId: string;
  iv: string;
  tag: string;
  data: string;
  fencingToken: number;
  writtenAt: string;
}

const ENVELOPE_VERSION = 1;
const MIN_KEY_LENGTH = 32;
const FILE_NAME = "auth-state.enc";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class AuthStateStore {
  private readonly dir: string;
  private readonly file: string;
  private readonly tmpFile: string;
  private readonly key: Buffer;
  private readonly keyId: string;
  /** Последний токен, прочитанный/записанный на диске (fencing). */
  private persistedToken = 0;
  /** Сериализация записей внутри процесса (writer queue). */
  private queue: Promise<void> = Promise.resolve();

  constructor(options: AuthStateStoreOptions) {
    const material = (options.encryptionKeyMaterial ?? "").trim();
    if (material.length === 0) {
      throw new WhatsAppAuthStateError(
        "missing_key",
        "WhatsApp auth state is not configured: WHATSAPP_AUTH_ENCRYPTION_KEY is missing (fail-closed)",
      );
    }
    if (material.length < MIN_KEY_LENGTH) {
      throw new WhatsAppAuthStateError(
        "key_too_short",
        `WHATSAPP_AUTH_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters (fail-closed)`,
      );
    }
    this.dir = path.resolve(options.sessionPath);
    this.file = path.join(this.dir, options.fileName ?? FILE_NAME);
    this.tmpFile = `${this.file}.tmp`;
    this.key = crypto.createHash("sha256").update(material, "utf8").digest();
    this.keyId = crypto.createHash("sha256").update(this.key).digest("hex").slice(0, 16);
  }

  /** Последний fencing token, известный хранилищу. */
  get persistedFencingToken(): number {
    return this.persistedToken;
  }

  /** Путь файла (диагностика; не содержит содержимого). */
  get filePath(): string {
    return this.file;
  }

  /**
   * Загрузка документа. null — файла ещё нет (fresh session).
   * Ошибки (corrupt/integrity/key_mismatch) НЕ приводят к авто-сбросу:
   * вызывающий обязан пробросить их наружу (ERROR state, ручной reset).
   */
  async load(): Promise<AuthDocument | null> {
    let raw: string;
    try {
      raw = await fsp.readFile(this.file, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
      throw new WhatsAppAuthStateError("io", `Failed to read WhatsApp auth state file: ${code ?? "unknown"}`, error);
    }

    let envelope: AuthEnvelope;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) throw new Error("not an object");
      envelope = parsed as unknown as AuthEnvelope;
    } catch (error) {
      throw new WhatsAppAuthStateError(
        "corrupt",
        "WhatsApp auth state file is corrupted (invalid envelope); manual session-reset required — automatic reset is forbidden",
        error,
      );
    }
    if (
      envelope.v !== ENVELOPE_VERSION ||
      typeof envelope.keyId !== "string" ||
      typeof envelope.iv !== "string" ||
      typeof envelope.tag !== "string" ||
      typeof envelope.data !== "string" ||
      typeof envelope.fencingToken !== "number"
    ) {
      throw new WhatsAppAuthStateError(
        "corrupt",
        "WhatsApp auth state file is corrupted (envelope fields missing); manual session-reset required",
      );
    }
    if (envelope.keyId !== this.keyId) {
      throw new WhatsAppAuthStateError(
        "key_mismatch",
        "WHATSAPP_AUTH_ENCRYPTION_KEY does not match the key used to write the session (rotation without migration)",
      );
    }

    let plaintext: Buffer;
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
    } catch (error) {
      throw new WhatsAppAuthStateError(
        "integrity",
        "WhatsApp auth state integrity check failed (AES-256-GCM); manual session-reset required",
        error,
      );
    }

    let doc: AuthDocument;
    try {
      const parsed: unknown = JSON.parse(plaintext.toString("utf8"));
      if (
        !isRecord(parsed) ||
        !isRecord((parsed as { creds?: unknown }).creds) ||
        !isRecord((parsed as { keys?: unknown }).keys) ||
        typeof (parsed as { fencingToken?: unknown }).fencingToken !== "number"
      ) {
        throw new Error("invalid document shape");
      }
      doc = parsed as unknown as AuthDocument;
    } catch (error) {
      throw new WhatsAppAuthStateError(
        "corrupt",
        "WhatsApp auth state document is corrupted (invalid shape); manual session-reset required",
        error,
      );
    }
    this.persistedToken = doc.fencingToken;
    return doc;
  }

  /**
   * Crash-safe сохранение: temp → fsync → rename (+fsync каталога).
   * Fencing: токен не может быть старее уже записанного на диск —
   * зомби-инстанс, потерявший lease, не может перезаписать сессию нового
   * владельца (проверка по фактическому файлу, не только по памяти).
   */
  async save(document: { creds: Record<string, unknown>; keys: Record<string, unknown> }, fencingToken: number): Promise<void> {
    return this.enqueue(async () => {
      const diskToken = await this.readDiskToken();
      if (!Number.isInteger(fencingToken) || fencingToken < diskToken || fencingToken < this.persistedToken) {
        throw new WhatsAppAuthStateError(
          "stale_fencing_token",
          `Stale fencing token for auth-state write: ${fencingToken} (disk=${diskToken}, memory=${this.persistedToken}); instance lost the session lease`,
        );
      }
      const payload = this.encrypt({ creds: document.creds, keys: document.keys, fencingToken });
      await this.atomicWrite(payload);
      this.persistedToken = fencingToken;
    });
  }

  /**
   * Явное уничтожение локальной сессии (logout / session-reset).
   * Единственный путь удаления; load()-ошибки сюда не приводят никогда.
   */
  async wipe(fencingToken: number): Promise<void> {
    return this.enqueue(async () => {
      this.assertToken(fencingToken);
      await fsp.rm(this.file, { force: true });
      await fsp.rm(this.tmpFile, { force: true });
      this.persistedToken = fencingToken;
    });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private assertToken(fencingToken: number): void {
    if (!Number.isInteger(fencingToken) || fencingToken < this.persistedToken) {
      throw new WhatsAppAuthStateError(
        "stale_fencing_token",
        `Stale fencing token for auth-state operation: ${fencingToken} < ${this.persistedToken} (instance lost the session lease)`,
      );
    }
  }

  /**
   * Fencing-токен из фактического файла: null — файла нет; unreadable —
   * внешняя порча конверта → отказ перезаписывать (fail-closed).
   */
  private async readDiskToken(): Promise<number> {
    let raw: string;
    try {
      raw = await fsp.readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw new WhatsAppAuthStateError("io", "Failed to re-read auth state file before write", error);
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const token = (parsed as { fencingToken?: unknown }).fencingToken;
      if (typeof token !== "number") throw new Error("missing fencingToken");
      return token;
    } catch (error) {
      throw new WhatsAppAuthStateError(
        "corrupt",
        "Auth state envelope unreadable before write; refusing to overwrite (manual session-reset required)",
        error,
      );
    }
  }

  private encrypt(document: AuthDocument): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(document), "utf8");
    const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope: AuthEnvelope = {
      v: ENVELOPE_VERSION,
      keyId: this.keyId,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64"),
      fencingToken: document.fencingToken,
      writtenAt: new Date().toISOString(),
    };
    return JSON.stringify(envelope);
  }

  private async atomicWrite(payload: string): Promise<void> {
    await fsp.mkdir(this.dir, { recursive: true });
    let handle: fsp.FileHandle | undefined;
    try {
      handle = await fsp.open(this.tmpFile, "w");
      await handle.writeFile(payload, "utf8");
      await handle.sync(); // fsync ДО rename — crash-safe
    } finally {
      if (handle) await handle.close().catch(() => undefined);
    }
    await fsp.rename(this.tmpFile, this.file);
    if (process.platform !== "win32") {
      try {
        const dirHandle = await fsp.open(this.dir, "r");
        try {
          await dirHandle.sync();
        } finally {
          await dirHandle.close();
        }
      } catch {
        // fsync каталога — best effort (не все ФС позволяют).
      }
    }
  }

  /** Writer queue: сериализует save/wipe, не отравляет цепочку ошибками. */
  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
