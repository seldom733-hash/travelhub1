import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorageService, PutObjectInput, StoredObject } from "./storage.interface";

/**
 * S3-compatible object storage (Phase 1 Step 1.2).
 *
 * Endpoint конфигурируется через env — работает с любым S3-совместимым
 * провайдером: MinIO (local/test, path-style) и AWS S3 / WASABI (production).
 * Бакет приватный: файлы отдаются только через short-lived signed read URL.
 */
@Injectable()
export class S3ObjectStorageService implements ObjectStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.S3_REGION ?? "us-east-1";
    this.bucket = process.env.S3_BUCKET ?? "travelhub-media";
    const endpoint = process.env.S3_ENDPOINT; // e.g. http://localhost:9000 (MinIO); AWS S3 — без endpoint
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true";

    this.client = new S3Client({
      region: this.region,
      endpoint: endpoint && endpoint.length > 0 ? endpoint : undefined,
      forcePathStyle,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
      },
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key: input.key, size: input.body.length };
  }

  async deleteObject(key: string): Promise<void> {
    // Idempotent: удаление несуществующего объекта не является ошибкой (S3 semantics).
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if ((err as { name?: string }).name === "NotFound" || (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}
