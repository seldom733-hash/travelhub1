import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { hotelPhotoUrl } from "../hotel/hotel-photo-url";

export type SuggestType = "destination" | "hotel" | "tour" | "service";

export interface SuggestResult {
  type: SuggestType;
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
  href: string;
}

@Injectable()
export class PublicSuggestService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string, type: string, limit: number): Promise<SuggestResult[]> {
    const like = `%${q}%`;
    const maxPerType = Math.min(Math.max(1, limit), 10);

    const typesToQuery: SuggestType[] = type === "all"
      ? ["destination", "hotel", "tour", "service"]
      : [type as SuggestType];

    const queries = typesToQuery.map((t) => this.queryByType(t, like, maxPerType));
    const results = await Promise.all(queries);
    return results.flat();
  }

  private async queryByType(type: SuggestType, like: string, limit: number): Promise<SuggestResult[]> {
    const categoryFilter = this.categoryFilterForType(type);

    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      title: string;
      description: string | null;
      slug: string;
      code: string;
      categoryTitle: string | null;
      thumbnailStorageKey: string | null;
      hotelPhotoFile: string | null;
      hotelPhotoVersion: Date | null;
    }>>(Prisma.sql`
      SELECT
        p."id",
        p."title",
        p."description",
        p."slug",
        p."code",
        c."title" AS "categoryTitle",
        m."thumbnailStorageKey",
        h."photoFile" AS "hotelPhotoFile",
        h."photoUpdatedAt" AS "hotelPhotoVersion"
      FROM catalog."Product" p
      LEFT JOIN catalog."Category" c ON c."id" = p."categoryId"
      LEFT JOIN catalog."ProductMedia" m ON m."productId" = p."id" AND m."isPrimary" = true AND m."status" = 'PUBLISHED'
      -- Единое фото физической гостиницы: (supplierCode, hotelKey) → реестр отелей.
      LEFT JOIN catalog."HotelSupplierRef" r
        ON r."supplierCode" = p."attributes"->>'supplierCode'
       AND r."externalKey"  = p."attributes"->>'hotelKey'
      LEFT JOIN catalog."Hotel" h ON h."id" = r."hotelId"
      WHERE p."status" = 'PUBLISHED'
        AND p."publishedAt" IS NOT NULL
        AND (p."title" ILIKE ${like} OR p."description" ILIKE ${like})
        AND ${categoryFilter}
      ORDER BY p."title" ASC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      type,
      id: r.id,
      name: r.title,
      subtitle: r.categoryTitle ?? undefined,
      // Фото отеля из единого реестра — та же ссылка, что и в карточках каталога,
      // турах и PDP. `?v=` — версия файла, чтобы после замены фото кэш не отдавал
      // старое изображение. Фолбэк — медиа продукта.
      imageUrl: r.hotelPhotoFile
        ? hotelPhotoUrl(r.hotelPhotoFile, r.hotelPhotoVersion)
        : r.thumbnailStorageKey
          ? `/api/v1/public/media/${r.id}/thumb`
          : undefined,
      // Нейтральные URL: саджест ведёт на PRD-код, slug-ссылки мертвы (404).
      href: `/products/${r.code}`,
    }));
  }

  private categoryFilterForType(type: SuggestType): Prisma.Sql {
    switch (type) {
      case "destination":
        return Prisma.sql`c."slug" IN ('destination', 'accommodation')`;
      case "hotel":
        return Prisma.sql`c."slug" = 'accommodation'`;
      case "tour":
        return Prisma.sql`c."slug" = 'tours'`;
      case "service":
        return Prisma.sql`c."slug" NOT IN ('destination', 'accommodation', 'tours')`;
      default:
        return Prisma.sql`true`;
    }
  }
}
