/**
 * Object storage abstraction (Phase 1 Step 1.2, ТЗ §3).
 *
 * Catalog НЕ зависит от cloud vendor. Доменный сервис (ProductMediaService)
 * зависит ТОЛЬКО от этого интерфейса; конкретная реализация (S3-compatible:
 * MinIO / WASABI / AWS S3) подставляется через DI.
 *
 * Требования:
 * - binary-файлы — в Object Storage, metadata — в PostgreSQL;
 * - bucket private by default (uploaded != published);
 * - внутренние storage keys никогда не публикуются — только short-lived
 *   signed read URL (getSignedReadUrl);
 * - никаких filesystem paths / credentials / secrets наружу.
 */
export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredObject {
  key: string;
  size: number;
}

export interface ObjectStorageService {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  /** Short-lived signed read URL (private bucket). */
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}
