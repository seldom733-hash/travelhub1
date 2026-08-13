import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaymentPrepaymentType, PaymentScheme } from "../../generated/prisma/enums";
import { Type } from "class-transformer";
import { Request } from "express";
import { SalesService } from "./sales.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { CheckoutStatus } from "../../generated/prisma/enums";
import {
  CHECKOUT_CANCEL_FORBIDDEN_KEYS,
  CHECKOUT_CREATE_FORBIDDEN_KEYS,
  CHECKOUT_REVALIDATE_FORBIDDEN_KEYS,
  CHECKOUT_SERVICE_DATE_FORBIDDEN_KEYS,
  CHECKOUT_TRAVELER_ITEM_FORBIDDEN_KEYS,
  CHECKOUT_TRAVELERS_FORBIDDEN_KEYS,
  PAYMENT_TERMS_FORBIDDEN_KEYS,
} from "./sales.validation";
import { SALES_SORT_FIELDS } from "./sales.filters";

/** Step 2.3A: traveler input (минимум; без passport/document/payment данных). */
class CheckoutTravelerInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsISO8601()
  birthDate?: string;
}

/** Create: только quoteId + optional customerId/serviceDate/travelers. Frontend НЕ источник цены. */
class CreateCheckoutIntentDto {
  @IsString()
  @MaxLength(64)
  quoteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  serviceDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutTravelerInputDto)
  travelers?: CheckoutTravelerInputDto[];
}

/** Travelers replace-all (только travelers + expectedVersion). */
class UpdateCheckoutTravelersDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutTravelerInputDto)
  travelers!: CheckoutTravelerInputDto[];

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** Service occurrence (Step 2.8A): serviceDate (date-only) + опциональные
 *  serviceTime/serviceEndTime (local HH:mm) + expectedVersion. Zone/instants —
 *  server-owned (forbidden keys). null = очистить time (вернуться к date-only). */
class SetCheckoutServiceDateDto {
  @IsString()
  @MaxLength(16)
  serviceDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  serviceTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  serviceEndTime?: string | null;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** Revalidate/cancel: только expectedVersion (CAS). */
class CheckoutVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** Step 2.3B: payment terms — только user-selectable scheme-параметры + CAS.
 *  Derived amounts (initial/remaining) server-computed из frozen total. */
class SetPaymentTermsDto {
  @IsEnum(PaymentScheme)
  scheme!: PaymentScheme;

  @IsOptional()
  @IsEnum(PaymentPrepaymentType)
  prepaymentType?: PaymentPrepaymentType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  prepaymentValue?: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** Список: whitelist-фильтры + пагинация (те же conventions, что Step 2.2). */
class ListCheckoutQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsEnum(CheckoutStatus)
  status?: CheckoutStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsIn(SALES_SORT_FIELDS as unknown as string[])
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: string;
}

/** History: только пагинация. */
class CheckoutHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

/**
 * PHASE 2 STEP 2.3A — Checkout / Commercial Intent (/api/v1/sales/checkouts).
 *
 * Internal staff-assisted flow (SALES_MANAGER write, DIRECTOR read):
 *  - create из ISSUED Quote (frozen totals, без reprice);
 *  - action-oriented мутации (travelers / service-date / revalidate / cancel),
 *    НИКАКОГО generic PATCH (§37); все мутации требуют expectedVersion (CAS, §34);
 *  - availability read-only "checked, not reserved" (§15);
 *  - server-owned поля (money/currency/source/status/options) — forbidden keys;
 *  - BUYER/PARTNER/FINANCE/aggregate-only роли — 403 (raw checkout context
 *    содержит PII-adjacent travelers + frozen money snapshot).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("sales/checkouts")
export class CheckoutController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @RequirePermissions("sales.checkout.write")
  create(@Body() dto: CreateCheckoutIntentDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    assertNoForbiddenKeys(req.body, CHECKOUT_CREATE_FORBIDDEN_KEYS);
    const raw = (req.body as { travelers?: unknown[] } | undefined)?.travelers;
    if (raw) {
      for (const t of raw) assertNoForbiddenKeys(t, CHECKOUT_TRAVELER_ITEM_FORBIDDEN_KEYS);
    }
    return this.sales.createCheckoutIntent(
      { quoteId: dto.quoteId, customerId: dto.customerId, serviceDate: dto.serviceDate, travelers: dto.travelers },
      { id: actor.id, username: actor.username },
    );
  }

  @Get()
  @RequirePermissions("sales.checkout.read")
  list(@Query() query: ListCheckoutQueryDto) {
    return this.sales.listCheckoutIntents(query);
  }

  @Get(":code")
  @RequirePermissions("sales.checkout.read")
  get(@Param("code") code: string) {
    return this.sales.getCheckoutIntentByCode(code);
  }

  @Get(":code/history")
  @RequirePermissions("sales.checkout.read")
  history(@Param("code") code: string, @Query() query: CheckoutHistoryQueryDto) {
    return this.sales.checkoutIntentHistory(code, query.page, query.pageSize);
  }

  @Put(":code/travelers")
  @RequirePermissions("sales.checkout.write")
  updateTravelers(
    @Param("code") code: string,
    @Body() dto: UpdateCheckoutTravelersDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, CHECKOUT_TRAVELERS_FORBIDDEN_KEYS);
    const raw = (req.body as { travelers?: unknown[] } | undefined)?.travelers;
    if (raw) {
      for (const t of raw) assertNoForbiddenKeys(t, CHECKOUT_TRAVELER_ITEM_FORBIDDEN_KEYS);
    }
    return this.sales.setCheckoutTravelers(code, dto.travelers, dto.expectedVersion, { id: actor.id, username: actor.username });
  }

  @Put(":code/service-date")
  @RequirePermissions("sales.checkout.write")
  updateServiceDate(
    @Param("code") code: string,
    @Body() dto: SetCheckoutServiceDateDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    // Step 2.8A: zone/instants — server-owned (не forge-ятся); только serviceDate
    // + serviceTime/serviceEndTime (local HH:mm, optional).
    assertNoForbiddenKeys(req.body, CHECKOUT_SERVICE_DATE_FORBIDDEN_KEYS);
    return this.sales.setCheckoutServiceDate(
      code,
      { serviceDate: dto.serviceDate, serviceTime: dto.serviceTime ?? null, serviceEndTime: dto.serviceEndTime ?? null },
      dto.expectedVersion,
      { id: actor.id, username: actor.username },
    );
  }

  @Post(":code/revalidate")
  @RequirePermissions("sales.checkout.write")
  revalidate(
    @Param("code") code: string,
    @Body() dto: CheckoutVersionDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, CHECKOUT_REVALIDATE_FORBIDDEN_KEYS);
    return this.sales.revalidateCheckoutIntent(code, dto.expectedVersion, { id: actor.id, username: actor.username });
  }

  @Post(":code/cancel")
  @RequirePermissions("sales.checkout.write")
  cancel(
    @Param("code") code: string,
    @Body() dto: CheckoutVersionDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, CHECKOUT_CANCEL_FORBIDDEN_KEYS);
    return this.sales.cancelCheckoutIntent(code, dto.expectedVersion, { id: actor.id, username: actor.username });
  }

  @Put(":code/payment-terms")
  @RequirePermissions("sales.checkout.write")
  updatePaymentTerms(
    @Param("code") code: string,
    @Body() dto: SetPaymentTermsDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, PAYMENT_TERMS_FORBIDDEN_KEYS);
    return this.sales.setCheckoutPaymentTerms(
      code,
      { scheme: dto.scheme, prepaymentType: dto.prepaymentType ?? null, prepaymentValue: dto.prepaymentValue ?? null },
      dto.expectedVersion,
      { id: actor.id, username: actor.username },
    );
  }
}
