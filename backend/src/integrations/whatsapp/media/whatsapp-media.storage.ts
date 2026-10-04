import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

/** Метаданные staged-загрузки (доживает до рестарта через meta.json). */
export interface StagedUploadMeta {
  readonly uploadId: string;
  readonly filename: string;
  readonly mimetype: string;
  readonly size: number;
}

export interface StagedUpload extends StagedUploadMeta {
  readonly bytes: Uint8Array;
}

/** Файл, сохранённый на постоянное место (путь уходит в mediaPath БД). */
export interface SavedMediaFile {
  readonly filename: string;
  readonly mimetype: string;
  readonly size: number;
  /** Относительный путь от корня mediaDir. */
  readonly relativePath: string;
}

const FILENAME_MAX = 120;
const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Безопасное имя файла: без путей, без control/спецсимволов, ≤120 символов. */
export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").trim();
  const usable = cleaned.length > 0 && cleaned !== "." && cleaned !== ".." ? cleaned : "file";
  if (usable.length <= FILENAME_MAX) return usable;
  const dot = usable.lastIndexOf(".");
  const ext = dot > 0 && usable.length - dot <= 12 ? usable.slice(dot) : "";
  return usable.slice(0, FILENAME_MAX - ext.length) + ext;
}

function safeDirSegment(raw: string): string {
  const cleaned = raw.replace(/[^0-9A-Za-z_-]/g, "").slice(0, 64);
  return cleaned.length > 0 ? cleaned : randomUUID();
}

/**
 * M3+: файлы local↔local через WhatsApp.
 *
 * Раскладка под WHATSAPP_MEDIA_DIR:
 *   uploads/<uploadId>/<file> + meta.json — staged-загрузка до send;
 *   outbound/<outboundId>/<file>          — файл исходящего (mediaPath);
 *   inbound/<providerMessageId>/<file>     — скачанное входящее.
 * mediaPath в БД — относительный путь (каталог переезжает вместе с volume).
 */
export class WhatsAppMediaStorage {
  constructor(private readonly rootDir: string) {}

  newUploadId(): string {
    return randomUUID();
  }

  assertUploadId(uploadId: string): void {
    if (!UPLOAD_ID_RE.test(uploadId)) throw new Error("invalid upload id");
  }

  async stageUpload(
    upload: { originalname: string; mimetype?: string | null; size: number; bytes: Uint8Array },
    uploadId: string,
  ): Promise<StagedUploadMeta> {
    this.assertUploadId(uploadId);
    const filename = sanitizeFilename(upload.originalname);
    const mimetype = (upload.mimetype ?? "").trim() || "application/octet-stream";
    const dir = path.join(this.rootDir, "uploads", uploadId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), upload.bytes);
    const meta = { filename, mimetype, size: upload.size };
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta));
    return { uploadId, ...meta };
  }

  async readUpload(uploadId: string): Promise<StagedUpload | null> {
    this.assertUploadId(uploadId);
    const dir = path.join(this.rootDir, "uploads", uploadId);
    try {
      const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")) as StagedUploadMeta;
      const bytes = await fs.readFile(path.join(dir, meta.filename));
      return { ...meta, uploadId, size: bytes.length, bytes };
    } catch {
      return null;
    }
  }

  /** Переносит staged-загрузку на постоянное место и чистит uploads/<id>. */
  async adoptUpload(uploadId: string, ownerId: string): Promise<SavedMediaFile | null> {
    const staged = await this.readUpload(uploadId);
    if (!staged) return null;
    const owner = safeDirSegment(ownerId);
    const dir = path.join(this.rootDir, "outbound", owner);
    await fs.mkdir(dir, { recursive: true });
    const target = path.join(dir, staged.filename);
    await fs.writeFile(target, staged.bytes);
    await fs.rm(path.join(this.rootDir, "uploads", uploadId), { recursive: true, force: true });
    return {
      filename: staged.filename,
      mimetype: staged.mimetype,
      size: staged.size,
      relativePath: path.posix.join("outbound", owner, staged.filename),
    };
  }

  async saveInbound(
    providerMessageId: string,
    media: { filename?: string | null; mimetype?: string | null; size?: number | null; bytes: Uint8Array },
  ): Promise<SavedMediaFile | null> {
    if (!media.bytes || media.bytes.length === 0) return null;
    const dirName = safeDirSegment(providerMessageId);
    const filename = sanitizeFilename(media.filename ?? "file");
    const dir = path.join(this.rootDir, "inbound", dirName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), media.bytes);
    return {
      filename,
      mimetype: (media.mimetype ?? "").trim() || "application/octet-stream",
      size: media.bytes.length,
      relativePath: path.posix.join("inbound", dirName, filename),
    };
  }

  async readRelative(relativePath: string): Promise<Buffer | null> {
    if (!relativePath || path.isAbsolute(relativePath)) return null;
    const resolvedRoot = path.resolve(this.rootDir);
    const resolved = path.resolve(this.rootDir, relativePath);
    if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) return null;
    try {
      return await fs.readFile(resolved);
    } catch {
      return null;
    }
  }
}
