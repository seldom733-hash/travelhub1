import { Injectable } from "@nestjs/common";
import sharp, { type Sharp } from "sharp";
import { ValidationDomainError } from "../../../shared/errors";

/**
 * MediaProcessor (Phase 1 Step 1.2, ТЗ §7–9) — server-side обработка изображений.
 *
 * Pipeline:
 *  1. upload limits (multer) → 2. MIME/signature → 3. реальный decode →
 *  4. metadata → 5. EXIF orientation → 6. strip metadata → 7. pixel limit →
 *  8. derivatives (original + large.webp + thumb.webp) → 9. пропорции сохранены
 *     (fit: inside, без upscale).
 *
 * Input: JPEG/PNG/WebP. SVG НЕ принимается (detectImageFormat → null).
 * Ограничения: max source 15 MB (multer), max dimensions 12000×12000.
 */

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF" + байты 8..11 = "WEBP"

export const MAX_IMAGE_DIMENSION = 12000;
export const LARGE_BOUNDING = 1600; // Product Detail gallery (1600–1920 px)
export const THUMB_BOUNDING = 480; // Marketplace card/listing (400–600 px)

export type ImageFormat = "jpeg" | "png" | "webp";

export interface ProcessedImage {
  /** Оптимизированный оригинал (EXIF orientation нормализован, metadata удалены). */
  original: Buffer;
  /** large.webp — bounding 1600px, fit inside. */
  large: Buffer;
  /** thumb.webp — bounding 480px, fit inside. */
  thumb: Buffer;
  format: ImageFormat;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

/** Определить формат по магическим байтам. null — не JPEG/PNG/WebP (включая SVG). */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length < 12) return null;
  const head = (i: number) => buffer[i];
  if (head(0) === JPEG_MAGIC[0] && head(1) === JPEG_MAGIC[1] && head(2) === JPEG_MAGIC[2]) {
    return "jpeg";
  }
  if (PNG_MAGIC.every((b, i) => head(i) === b)) {
    return "png";
  }
  if (
    head(0) === WEBP_MAGIC[0] &&
    head(1) === WEBP_MAGIC[1] &&
    head(2) === WEBP_MAGIC[2] &&
    head(3) === WEBP_MAGIC[3] &&
    buffer.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

@Injectable()
export class MediaProcessor {
  /**
   * Проверить сигнатуру, декодировать и обработать изображение.
   * @param allowedMimeTypes допустимые MIME из mediaRequirements (undefined → JPEG/PNG/WebP)
   */
  async processImage(buffer: Buffer, allowedMimeTypes?: string[] | null): Promise<ProcessedImage> {
    const format = detectImageFormat(buffer);
    if (!format) {
      throw new ValidationDomainError("Invalid image: only JPEG, PNG or WebP are supported (SVG is not accepted)");
    }

    const mime = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
    const allow = allowedMimeTypes && allowedMimeTypes.length > 0 ? allowedMimeTypes : ["image/jpeg", "image/png", "image/webp"];
    if (!allow.includes(mime)) {
      throw new ValidationDomainError(`File type "${mime}" is not allowed for this product (allowed: ${allow.join(", ")})`);
    }

    try {
      const img = sharp(buffer, { failOn: "error", limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION });
      const meta = await img.metadata();
      if (!meta.width || !meta.height) {
        throw new ValidationDomainError("Image has no readable dimensions");
      }
      if (meta.width > MAX_IMAGE_DIMENSION || meta.height > MAX_IMAGE_DIMENSION) {
        throw new ValidationDomainError(
          `Image dimensions ${meta.width}×${meta.height} exceed the limit ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}`,
        );
      }

      // Ориентация по EXIF + перекодирование без metadata (sharp не копирует EXIF
      // при перекодировании, если не вызван withMetadata()).
      const oriented = (b: Buffer) => sharp(b, { failOn: "error", limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION }).rotate();

      const original = await this.encodeOriginal(oriented(buffer), format);
      const large = await this.encodeDerivative(oriented(buffer), LARGE_BOUNDING);
      const thumb = await this.encodeDerivative(oriented(buffer), THUMB_BOUNDING);

      return {
        original,
        large,
        thumb,
        format,
        mimeType: mime,
        width: meta.width,
        height: meta.height,
        size: original.length,
      };
    } catch (err) {
      if (err instanceof ValidationDomainError) throw err;
      throw new ValidationDomainError(`Image processing failed: ${(err as Error).message}`);
    }
  }

  /** Оригинал: перекодирование в исходном формате (без metadata), без upscale. */
  private async encodeOriginal(img: Sharp, format: ImageFormat): Promise<Buffer> {
    switch (format) {
      case "jpeg":
        return img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      case "png":
        return img.png({ compressionLevel: 9 }).toBuffer();
      case "webp":
        return img.webp({ quality: 85 }).toBuffer();
    }
  }

  /** Derivative в WebP: fit inside bounding box, без upscale, пропорции сохранены. */
  private async encodeDerivative(img: Sharp, bounding: number): Promise<Buffer> {
    return img
      .resize({ width: bounding, height: bounding, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  }
}
