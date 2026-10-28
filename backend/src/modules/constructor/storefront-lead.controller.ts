import { Body, Controller, Param, Post, BadRequestException, NotFoundException } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { Public } from "../../security/auth/decorators";

class StorefrontLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  contact!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsBoolean()
  consent!: boolean;

  /** Honeypot: must stay empty (bots fill it). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;
}

/**
 * Public lead form for a Storefront site. Only ACTIVE + entitled storefronts
 * accept leads; raw contact data is stored in sales.LeadHistory, not exposed by
 * the public storefront API.
 */
@Controller()
export class StorefrontLeadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
  ) {}

  @Post("public/storefronts/:slug/request")
  @Public()
  async create(@Param("slug") slug: string, @Body() dto: StorefrontLeadDto) {
    if (!dto.consent) throw new BadRequestException("Consent is required");
    if (dto.company?.trim()) return { ok: true }; // silently drop bot submissions

    const sf = await this.prisma.partnerStorefront.findUnique({ where: { slug }, select: { id: true, partnerId: true, status: true, activatedAt: true, entitlementStatus: true } });
    if (!sf || sf.status !== "ACTIVE" || !sf.activatedAt || sf.entitlementStatus !== "ACTIVE") {
      throw new NotFoundException("Storefront not found");
    }

    await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "LED");
      const lead = await tx.lead.create({
        data: {
          code,
          name: dto.name.trim(),
          status: "NEW",
          createdById: null,
        },
      });
      await tx.leadHistory.create({
        data: {
          leadId: lead.id,
          action: "created",
          fields: {
            source: "STOREFRONT",
            partnerId: sf.partnerId,
            storefrontId: sf.id,
            storefrontSlug: slug,
            contact: dto.contact.trim(),
            message: dto.message?.trim() || null,
            consent: true,
          } as any,
        },
      });
    });
    return { ok: true };
  }
}
