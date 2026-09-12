import { Controller, Get, Param, Body, Put } from "@nestjs/common";
import { IsArray, ValidateNested, IsString, IsBoolean, IsNumber, IsOptional, ValidateIf } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import { ConstructorService, type PageSectionInput, type PageConfigView } from "./constructor.service";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

// ─── DTOs ────────────────────────────────────────────────────────────────────

class PageSectionInputDto implements PageSectionInput {
  @IsString() blockType!: string;
  @IsString() blockInstanceId!: string;
  @IsNumber() sortOrder!: number;
  @IsBoolean() enabled!: boolean;
  @IsOptional() settings?: Record<string, unknown>;
  @IsOptional() style?: Record<string, unknown>;
  @IsOptional() responsive?: Record<string, unknown>;
  @IsOptional() dataSource?: Record<string, unknown>;
  @IsOptional() visibility?: Record<string, unknown> | null;
  @IsOptional() localeContent?: Record<string, unknown>;
}

class SaveDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSectionInputDto)
  sections!: PageSectionInputDto[];
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller("constructor")
export class ConstructorController {
  constructor(private readonly service: ConstructorService) {}

  @Get("pages/:slug")
  @RequirePermissions("catalog.product.read")
  async getPage(
    @Param("slug") slug: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.getPage(slug, actor.id);
  }

  @Put("pages/:slug/sections")
  @RequirePermissions("catalog.product.read")
  async saveDraft(
    @Param("slug") slug: string,
    @Body() body: SaveDraftDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveDraft(slug, body.sections, actor.id);
  }

  @Get("blocks/:context")
  @RequirePermissions("catalog.product.read")
  getRegistry(@Param("context") context: string) {
    return this.service.getRegistry(context);
  }
}
