import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { TourBuilderService } from "./tour-builder.service";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";

/**
 * Partner Tour Builder API (расширение Catalog Center).
 *
 * Базовый путь: /api/v1/tour-builder/products/:productId/...
 * RBAC: PARTNER — собственные Product (create_own/update_own_draft/read_own
 * через CatalogAccessPolicy в сервисе); staff/ADMIN — catalog.product.write/read.
 *
 * Все записи аудируются в security.AuditLog (tour_builder.*).
 */

class ComponentPayloadDto {
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

class AddComponentDto {
  @IsString() @IsNotEmpty() @MaxLength(32)
  kind!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsOptional() @IsBoolean()
  required?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  basePrice?: number;

  @IsOptional() @IsObject()
  componentPayload?: Record<string, unknown>;
}

class UpdateComponentPayloadDto {
  @IsObject()
  payload!: Record<string, unknown>;
}

class SetRequiredDto {
  @IsBoolean()
  required!: boolean;
}

/**
 * Вариант проживания = тариф юнита-типа номера. Фасеты хранятся в
 * Tariff.inclusions: viewCode (ViewType.code, опц.) / mealCode (MealType.code)
 * / placementCode (PlacementType.code) / extraBed / extraSofa (булевы оси
 * матрицы, true = вариант с доп. кроватью/диваном). Валидация кодов —
 * ACTIVE справочники; цены доп.опций — фикс на уровне пакета (package-rules).
 */
class CreateVariantDto {
  @IsOptional() @IsString() @MaxLength(64)
  viewCode?: string;

  @IsString() @IsNotEmpty() @MaxLength(64)
  mealCode!: string;

  @IsString() @IsNotEmpty() @MaxLength(64)
  placementCode!: string;

  @IsOptional() @IsBoolean()
  extraBed?: boolean;

  @IsOptional() @IsBoolean()
  extraSofa?: boolean;

  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsNumber() @Min(0)
  basePrice?: number;
}

class UpdateVariantDto {
  @IsOptional() @IsString() @MaxLength(64)
  viewCode?: string;

  @IsOptional() @IsString() @MaxLength(64)
  mealCode?: string;

  @IsOptional() @IsString() @MaxLength(64)
  placementCode?: string;

  @IsOptional() @IsBoolean()
  extraBed?: boolean;

  @IsOptional() @IsBoolean()
  extraSofa?: boolean;

  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsNumber() @Min(0)
  basePrice?: number;
}

/**
 * Слой календаря: kind PERIOD (диагональ/сезон; dayOfWeek — дни недели внутри
 * периода, пусто = каждый день) либо DATE_OVERRIDE (конкретные даты — высший
 * приоритет). Precedence — канонический period-resolution.ts.
 */
class CalendarPeriodDto {
  @IsString() @IsNotEmpty()
  startDate!: string;

  @IsString() @IsNotEmpty()
  endDate!: string;

  @IsNumber() @Min(0)
  price!: number;

  @IsOptional() @IsIn(["PERIOD", "DATE_OVERRIDE"])
  kind?: "PERIOD" | "DATE_OVERRIDE";

  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  dayOfWeek?: number[];
}

class AllotmentDayDto {
  @IsString() @IsNotEmpty()
  date!: string;

  @IsNumber() @Min(0)
  rooms!: number;
}

class SaveCalendarDto {
  @IsString() @IsNotEmpty()
  tariffId!: string;

  /**
   * Полный набор слоёв (replace-семантика). Пустой массив БЕЗ clearPeriods —
   * no-op: сохранение квоты/проверка не должна стирать цены. Явное «стереть
   * все слои» — только с clearPeriods=true.
   */
  @IsArray() @ValidateNested({ each: true }) @Type(() => CalendarPeriodDto)
  periods!: CalendarPeriodDto[];

  @IsOptional() @IsBoolean()
  clearPeriods?: boolean;

  @IsArray() @ValidateNested({ each: true }) @Type(() => AllotmentDayDto)
  allotment!: AllotmentDayDto[];
}

class PackageRulesDto {
  @IsOptional() @IsNumber() @Min(0)
  packageDiscountPct?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  freeTransferFromNights?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  grossOverrideAmount?: number | null;

  /** Фикс-цена Ext.Bed/Ext.Sofa, в валюте пакета/сут (0 = бесплатно); undefined = не менять. */
  @IsOptional() @IsNumber() @Min(0)
  extraBedPrice?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  extraSofaPrice?: number | null;

  /** Детская кровать (Baby Cot, бесплатно); undefined = не менять. */
  @IsOptional() @IsBoolean()
  babyCot?: boolean;

  /** Валюта пакета (шаг «Основная информация»); смена конвертирует все цены по fx. */
  @IsOptional() @IsIn(["USD", "EUR", "AZN"])
  currency?: "USD" | "EUR" | "AZN";

  /** Курс AZN за 1 USD (>0); undefined = не менять. */
  @IsOptional() @IsNumber() @Min(0.000001)
  fxUsdAzn?: number;

  /** Курс AZN за 1 EUR (>0); undefined = не менять. */
  @IsOptional() @IsNumber() @Min(0.000001)
  fxEurAzn?: number;
}

class QuoteChildDto {
  @IsNumber() @Min(0)
  age!: number;
}

class QuoteDto {
  @IsString() @IsNotEmpty()
  departureDate!: string;

  @IsNumber() @Min(1)
  nights!: number;

  @IsNumber() @Min(1)
  adults!: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteChildDto)
  children?: QuoteChildDto[];
}

class ProposeDictionaryEntryDto {
  @IsIn(["room-types", "view-types"])
  type!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  name!: string;

  @IsOptional() @IsIn(["ru", "en", "az"])
  lang?: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tour-builder/products/:productId")
export class TourBuilderController {
  constructor(private readonly builder: TourBuilderService) {}

  @Get()
  @RequirePermissions("catalog.product.read_own")
  getState(@Param("productId") productId: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.builder.getState(productId, actor);
  }

  @Post("components")
  @RequirePermissions("catalog.product.update_own_draft")
  addComponent(
    @Param("productId") productId: string,
    @Body() dto: AddComponentDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.addComponent(productId, dto as never, actor);
  }

  @Patch("components/:componentId/payload")
  @RequirePermissions("catalog.product.update_own_draft")
  updateComponentPayload(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @Body() dto: UpdateComponentPayloadDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.updateComponentPayload(productId, componentId, dto.payload as never, actor);
  }

  @Patch("components/:componentId/required")
  @RequirePermissions("catalog.product.update_own_draft")
  setRequired(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @Body() dto: SetRequiredDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.setRequired(productId, componentId, dto.required, actor);
  }

  @Delete("components/:componentId")
  @RequirePermissions("catalog.product.update_own_draft")
  removeComponent(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.removeComponent(productId, componentId, actor);
  }

  @Post("components/:componentId/variants")
  @RequirePermissions("catalog.product.update_own_draft")
  createVariant(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @Body() dto: CreateVariantDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.createVariant(productId, componentId, dto, actor);
  }

  @Patch("components/:componentId/variants/:variantId")
  @RequirePermissions("catalog.product.update_own_draft")
  updateVariant(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.updateVariant(productId, componentId, variantId, dto, actor);
  }

  @Delete("components/:componentId/variants/:variantId")
  @RequirePermissions("catalog.product.update_own_draft")
  removeVariant(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @Param("variantId") variantId: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.removeVariant(productId, componentId, variantId, actor);
  }

  @Post("components/:componentId/calendar")
  @RequirePermissions("catalog.product.update_own_draft")
  saveAccommodationCalendar(
    @Param("productId") productId: string,
    @Param("componentId") componentId: string,
    @Body() dto: SaveCalendarDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.saveAccommodationCalendar(productId, componentId, dto as never, actor);
  }

  @Patch("package-rules")
  @RequirePermissions("catalog.product.update_own_draft")
  setPackageRules(
    @Param("productId") productId: string,
    @Body() dto: PackageRulesDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.setPackageRules(productId, dto as never, actor);
  }

  @Post("quote")
  @RequirePermissions("catalog.product.read_own")
  quote(
    @Param("productId") productId: string,
    @Body() dto: QuoteDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.builder.quote(productId, dto as never, actor);
  }
}

/**
 * Справочники шага «Проживание» (типы номеров и видов): чтение ACTIVE-записей,
 * подсказки похожих (дедупликация ввода) и предложение новой записи
 * (PENDING → очередь модерации; решение №1 плана).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tour-builder/dictionaries")
export class TourBuilderDictionariesController {
  constructor(private readonly builder: TourBuilderService) {}

  @Get()
  @RequirePermissions("catalog.product.read_own")
  getDictionaries() {
    return this.builder.getDictionaries();
  }

  @Get("similar")
  @RequirePermissions("catalog.product.read_own")
  similar(@Query("type") type: string | undefined, @Query("q") q: string | undefined) {
    return this.builder.similarDictionaryEntries(type ?? "", q ?? "");
  }

  @Post("entries")
  @RequirePermissions("catalog.dictionary.propose")
  propose(@Body() dto: ProposeDictionaryEntryDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.builder.proposeDictionaryEntry(actor, dto);
  }
}
