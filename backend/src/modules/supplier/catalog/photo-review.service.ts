import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";
import sharp from "sharp";
import { PrismaService } from "../../../prisma/prisma.service";

export interface PhotoReviewItem {
  id: string;
  name: string;
  cityName: string;
  countryName: string;
  candidateTitle: string;
  candidateUrl: string;
  expectedName: string;
  score: number;
}

/**
 * Photo candidates that matched a hotel name only partially.
 *
 * The photo crawler deliberately never applies these; an operator confirms the
 * candidate name/image here before it becomes the hotel's primary photo.
 */
@Injectable()
export class PhotoReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PhotoReviewItem[]> {
    const hotels = await this.prisma.hotel.findMany({
      where: { photoStatus: "REVIEW" },
      select: {
        id: true,
        name: true,
        cityName: true,
        countryName: true,
        photoSourceUrl: true,
        photoAttribution: true,
      },
      orderBy: { photoUpdatedAt: "desc" },
      take: 200,
    });
    return hotels.map((hotel) => {
      let meta: Record<string, unknown> = {};
      try {
        meta = hotel.photoAttribution ? JSON.parse(hotel.photoAttribution) : {};
      } catch {
        meta = {};
      }
      return {
        id: hotel.id,
        name: hotel.name,
        cityName: hotel.cityName,
        countryName: hotel.countryName,
        candidateTitle: typeof meta.candidateTitle === "string" ? meta.candidateTitle : "",
        candidateUrl: hotel.photoSourceUrl ?? (typeof meta.candidateUrl === "string" ? meta.candidateUrl : ""),
        expectedName: typeof meta.expectedName === "string" ? meta.expectedName : hotel.name,
        score: typeof meta.score === "number" ? meta.score : 0,
      };
    }).filter((item) => item.candidateUrl);
  }

  async approve(id: string): Promise<{ id: string; photoFile: string }> {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, photoStatus: "REVIEW" },
      select: { id: true, name: true, photoSourceUrl: true },
    });
    if (!hotel) throw new NotFoundException("Photo review candidate not found");
    if (!hotel.photoSourceUrl || !/^https?:\/\//i.test(hotel.photoSourceUrl)) {
      throw new BadRequestException("Review candidate has no image URL");
    }

    let response: Response;
    try {
      response = await fetch(hotel.photoSourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new BadRequestException(`Could not download photo: ${(error as Error).message}`);
    }
    if (!response.ok) throw new BadRequestException(`Photo source returned HTTP ${response.status}`);
    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!/^image\//.test(mime)) throw new BadRequestException("Photo source is not an image");

    const original = Buffer.from(await response.arrayBuffer());
    if (original.length < 5_000) throw new BadRequestException("Photo is too small");
    const pipeline = sharp(original, { failOn: "error" }).rotate();
    const meta = await pipeline.metadata();
    const converted = await pipeline.resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const outMeta = await sharp(converted).metadata();
    if (converted.length < 5_000 || (outMeta.width ?? 0) < 400 || (outMeta.height ?? 0) < 300) {
      throw new BadRequestException("Photo is too small after processing");
    }

    const hotelDir = path.resolve(process.cwd(), "../frontend/public/hotels");
    await fs.mkdir(hotelDir, { recursive: true });
    const fileName = `hotel_${hotel.id}.webp`;
    const destination = path.join(hotelDir, fileName);
    const temp = `${destination}.tmp-${process.pid}`;
    await fs.writeFile(temp, converted);
    await fs.rename(temp, destination);

    const source = /bstatic\.com/i.test(hotel.photoSourceUrl) ? "booking" : "tripadvisor";
    await this.prisma.hotel.update({
      where: { id: hotel.id },
      data: {
        photoFile: fileName,
        photoStatus: "OK",
        photoSource: source,
        photoWidth: outMeta.width ?? meta.width ?? null,
        photoHeight: outMeta.height ?? meta.height ?? null,
        photoBytes: converted.length,
        photoAttribution: null,
        photoUpdatedAt: new Date(),
      },
    });
    return { id: hotel.id, photoFile: fileName };
  }

  async reject(id: string): Promise<{ id: string }> {
    const hotel = await this.prisma.hotel.findFirst({ where: { id, photoStatus: "REVIEW" } });
    if (!hotel) throw new NotFoundException("Photo review candidate not found");
    await this.prisma.hotel.update({
      where: { id },
      data: {
        photoStatus: "FAILED",
        photoSource: null,
        photoSourceUrl: null,
        photoAttribution: null,
        photoUpdatedAt: new Date(),
      },
    });
    return { id };
  }
}
