import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Request } from "express";
import { SalesService } from "./sales.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import {
  LeadStatus,
  OpportunityStatus,
  QuoteDiscountType,
  QuoteStatus,
  SaleStatus,
} from "../../generated/prisma/enums";
import {
  SALE_COMPLETE_FORBIDDEN_KEYS,
  SALES_ASSIGN_FORBIDDEN_KEYS,
  SALES_CREATE_FORBIDDEN_KEYS,
  SALES_QUOTE_COMMERCIAL_FORBIDDEN_KEYS,
  SALES_QUOTE_CUSTOMER_FORBIDDEN_KEYS,
  SALES_QUOTE_ITEM_FORBIDDEN_KEYS,
  SALES_QUOTE_ITEM_UPDATE_FORBIDDEN_KEYS,
  SALES_QUOTE_TRAVELER_FORBIDDEN_KEYS,
  SALES_QUOTE_TRAVELER_ITEM_FORBIDDEN_KEYS,
  SALES_TRANSITION_FORBIDDEN_KEYS,
} from "./sales.validation";
import { SALES_QUEUE_KEYS, SALES_QUEUES, SALES_SORT_FIELDS, type SalesQueueKey } from "./sales.filters";

/** Create Lead (foundation): имя + необязательные canonical refs. */
class CreateLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string;
}

/** Create Opportunity. */
class CreateOpportunityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string;
}

/** Create Quote (DRAFT foundation). */
class CreateQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string;
}

/** Create Sale (OPEN foundation). */
class CreateSaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string;

  /** Step 2.4: привязка Checkout контекста (обязателен для completion). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  checkoutIntentId?: string;
}

/** Step 2.4: completeSale — только expectedVersion (всё derived — server-side). */
class CompleteSaleDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** Transition-команды: только целевой status (lifecycle отдельной командой). */
class TransitionDto {
  @IsEnum(LeadStatus)
  status!: LeadStatus;
}

class TransitionOpportunityDto {
  @IsEnum(OpportunityStatus)
  status!: OpportunityStatus;
}

/**
 * Пагинация + фильтры (Step 2.2, §20/§33): whitelist, typed, bounded.
 * from/to — createdAt-range (ISO UTC, inclusive); search — display label;
 * code — exact canonical code; sort — whitelist {createdAt|code|status}.
 * Неизвестные query-параметры молча срезаются ValidationPipe (whitelist).
 */
class SalesListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

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

class ListLeadsQueryDto extends SalesListQueryDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;
}

class ListOpportunitiesQueryDto extends SalesListQueryDto {
  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  leadId?: string;
}

class ListQuotesQueryDto extends SalesListQueryDto {
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string;
}

class ListSalesQueryDto extends SalesListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;
}

/** History: только пагинация. */
class HistoryQueryDto {
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

/** Step 2.3: добавление строки КП — только refs + quantity (snapshot server-side).
 * Step 1.8C: опциональный serviceDate (date-only) — периодная цена резолвится
 * server-side на дату (иначе base fallback); client НЕ передаёт сумму.
 * Step 1.8D: опциональный durationDays (1..365) — вход restriction-оценки
 * (min/max-stay, CTD); сервер-валидирован, цену не пересчитывает. */
class AddQuoteItemDto {
  @IsString()
  @MaxLength(64)
  productId!: string;

  @IsString()
  @MaxLength(64)
  tariffId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsOptional()
  @IsString()
  serviceDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;
}

/** Step 2.3: обновление строки — только quantity. */
class UpdateQuoteItemDto {
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

/** Step 2.3: customer context — только customerId (null = unset). */
class SetQuoteCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string | null;
}

/** Step 2.3: traveler input (без passport/document/payment данных). */
class QuoteTravelerInputDto {
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

class SetQuoteTravelersDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteTravelerInputDto)
  travelers!: QuoteTravelerInputDto[];
}

/** Step 2.3: commercial-команда — только discountType/discountValue/validUntil. */
class SetQuoteCommercialDto {
  @IsEnum(QuoteDiscountType)
  discountType!: QuoteDiscountType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  discountValue?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}

/** Assign: только assignedToId (null = unassign); server-owned поля запрещены. */
class AssignDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string | null;
}

/** Queue: whitelist ключ + пагинация. */
class QueueQueryDto {
  @IsIn(SALES_QUEUE_KEYS as unknown as string[])
  queue!: SalesQueueKey;

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

/** KPI: опциональный createdAt-period (ISO UTC, inclusive). */
class KpiQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation: минимальный internal API
 * (/api/v1/sales/*). Только staff-роли с granular sales.* permissions;
 * BUYER/PARTNER/MODERATOR — 403. Объектный scope: внутренние списки —
 * санкционированный контекст (permission-гейт), ownership всегда из actor
 * (createdById), forged customerId/assignedToId — только business-ссылки,
 * валидируются server-side (existence), прав не расширяют (§30).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  /* ── Lead ─────────────────────────────────────────────────────────────── */

  @Post("leads")
  @RequirePermissions("sales.lead.write")
  createLead(@Body() dto: CreateLeadDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    assertNoForbiddenKeys(req.body, SALES_CREATE_FORBIDDEN_KEYS);
    return this.sales.createLead(
      { name: dto.name, customerId: dto.customerId, assignedToId: dto.assignedToId },
      { id: actor.id, username: actor.username },
    );
  }

  @Get("leads")
  @RequirePermissions("sales.lead.read")
  listLeads(@Query() query: ListLeadsQueryDto) {
    return this.sales.listLeads(query);
  }

  @Get("leads/:code")
  @RequirePermissions("sales.lead.read")
  getLead(@Param("code") code: string) {
    return this.sales.getLeadByCode(code);
  }

  @Get("leads/:code/history")
  @RequirePermissions("sales.lead.read")
  leadHistory(@Param("code") code: string, @Query() query: HistoryQueryDto) {
    return this.sales.leadHistory(code, query.page, query.pageSize);
  }

  @Post("leads/:code/assign")
  @RequirePermissions("sales.lead.write")
  assignLead(
    @Param("code") code: string,
    @Body() dto: AssignDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_ASSIGN_FORBIDDEN_KEYS);
    return this.sales.assignLead(code, dto.assignedToId ?? null, { id: actor.id, username: actor.username });
  }

  @Post("leads/:code/transition")
  @RequirePermissions("sales.lead.write")
  transitionLead(
    @Param("code") code: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_TRANSITION_FORBIDDEN_KEYS);
    return this.sales.transitionLead(code, dto.status, { id: actor.id, username: actor.username });
  }

  /* ── Opportunity ──────────────────────────────────────────────────────── */

  @Post("opportunities")
  @RequirePermissions("sales.opportunity.write")
  createOpportunity(@Body() dto: CreateOpportunityDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    assertNoForbiddenKeys(req.body, SALES_CREATE_FORBIDDEN_KEYS);
    return this.sales.createOpportunity(
      { title: dto.title, leadId: dto.leadId, customerId: dto.customerId, assignedToId: dto.assignedToId },
      { id: actor.id, username: actor.username },
    );
  }

  @Get("opportunities")
  @RequirePermissions("sales.opportunity.read")
  listOpportunities(@Query() query: ListOpportunitiesQueryDto) {
    return this.sales.listOpportunities(query);
  }

  @Get("opportunities/:code")
  @RequirePermissions("sales.opportunity.read")
  getOpportunity(@Param("code") code: string) {
    return this.sales.getOpportunityByCode(code);
  }

  @Get("opportunities/:code/history")
  @RequirePermissions("sales.opportunity.read")
  opportunityHistory(@Param("code") code: string, @Query() query: HistoryQueryDto) {
    return this.sales.opportunityHistory(code, query.page, query.pageSize);
  }

  @Post("opportunities/:code/assign")
  @RequirePermissions("sales.opportunity.write")
  assignOpportunity(
    @Param("code") code: string,
    @Body() dto: AssignDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_ASSIGN_FORBIDDEN_KEYS);
    return this.sales.assignOpportunity(code, dto.assignedToId ?? null, { id: actor.id, username: actor.username });
  }

  @Post("opportunities/:code/transition")
  @RequirePermissions("sales.opportunity.write")
  transitionOpportunity(
    @Param("code") code: string,
    @Body() dto: TransitionOpportunityDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_TRANSITION_FORBIDDEN_KEYS);
    return this.sales.transitionOpportunity(code, dto.status, { id: actor.id, username: actor.username });
  }

  /* ── Quote ────────────────────────────────────────────────────────────── */

  @Post("quotes")
  @RequirePermissions("sales.quote.write")
  createQuote(@Body() dto: CreateQuoteDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    assertNoForbiddenKeys(req.body, SALES_CREATE_FORBIDDEN_KEYS);
    return this.sales.createQuote(
      { customerId: dto.customerId, opportunityId: dto.opportunityId, productId: dto.productId },
      { id: actor.id, username: actor.username },
    );
  }

  @Get("quotes")
  @RequirePermissions("sales.quote.read")
  listQuotes(@Query() query: ListQuotesQueryDto) {
    return this.sales.listQuotes(query);
  }

  @Get("quotes/:code")
  @RequirePermissions("sales.quote.read")
  getQuote(@Param("code") code: string) {
    // Step 2.3: detail = commercial projection (QuoteDto superset + items/travelers).
    return this.sales.getQuoteDetail(code);
  }

  @Get("quotes/:code/history")
  @RequirePermissions("sales.quote.read")
  quoteHistory(@Param("code") code: string, @Query() query: HistoryQueryDto) {
    return this.sales.quoteHistory(code, query.page, query.pageSize);
  }

  @Post("quotes/:code/issue")
  @RequirePermissions("sales.quote.write")
  issueQuote(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.sales.issueQuote(code, { id: actor.id, username: actor.username });
  }

  /* ── Step 2.3 — Quote composition (action-oriented, DRAFT only) ─────────── */

  @Post("quotes/:code/items")
  @RequirePermissions("sales.quote.write")
  addQuoteItem(
    @Param("code") code: string,
    @Body() dto: AddQuoteItemDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_QUOTE_ITEM_FORBIDDEN_KEYS);
    return this.sales.addQuoteItem(code, dto, { id: actor.id, username: actor.username });
  }

  @Patch("quotes/:code/items/:itemId")
  @RequirePermissions("sales.quote.write")
  updateQuoteItem(
    @Param("code") code: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateQuoteItemDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_QUOTE_ITEM_UPDATE_FORBIDDEN_KEYS);
    return this.sales.updateQuoteItem(code, itemId, dto.quantity, { id: actor.id, username: actor.username });
  }

  @Delete("quotes/:code/items/:itemId")
  @RequirePermissions("sales.quote.write")
  removeQuoteItem(
    @Param("code") code: string,
    @Param("itemId") itemId: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.sales.removeQuoteItem(code, itemId, { id: actor.id, username: actor.username });
  }

  @Put("quotes/:code/customer")
  @RequirePermissions("sales.quote.write")
  setQuoteCustomer(
    @Param("code") code: string,
    @Body() dto: SetQuoteCustomerDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_QUOTE_CUSTOMER_FORBIDDEN_KEYS);
    return this.sales.setQuoteCustomer(code, dto.customerId ?? null, { id: actor.id, username: actor.username });
  }

  @Put("quotes/:code/travelers")
  @RequirePermissions("sales.quote.write")
  setQuoteTravelers(
    @Param("code") code: string,
    @Body() dto: SetQuoteTravelersDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_QUOTE_TRAVELER_FORBIDDEN_KEYS);
    // Raw-body nested check: server-owned поля внутри traveler-item (id/createdAt/…)
    // отбрасываются DTO-whitelist'ом молча — делаем явный 422 (contract §23).
    const raw = (req.body as { travelers?: unknown[] } | undefined)?.travelers;
    if (raw) {
      for (const t of raw) assertNoForbiddenKeys(t, SALES_QUOTE_TRAVELER_ITEM_FORBIDDEN_KEYS);
    }
    return this.sales.setQuoteTravelers(code, dto.travelers, { id: actor.id, username: actor.username });
  }

  @Put("quotes/:code/commercial")
  @RequirePermissions("sales.quote.write")
  setQuoteCommercial(
    @Param("code") code: string,
    @Body() dto: SetQuoteCommercialDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    assertNoForbiddenKeys(req.body, SALES_QUOTE_COMMERCIAL_FORBIDDEN_KEYS);
    return this.sales.setQuoteCommercial(
      code,
      { discountType: dto.discountType, discountValue: dto.discountValue ?? null, validUntil: dto.validUntil ?? null },
      { id: actor.id, username: actor.username },
    );
  }

  /* ── Sale ─────────────────────────────────────────────────────────────── */

  @Post("sales")
  @RequirePermissions("sales.sale.write")
  createSale(@Body() dto: CreateSaleDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    assertNoForbiddenKeys(req.body, SALES_CREATE_FORBIDDEN_KEYS);
    return this.sales.createSale(
      { customerId: dto.customerId, opportunityId: dto.opportunityId, quoteId: dto.quoteId, checkoutIntentId: dto.checkoutIntentId },
      { id: actor.id, username: actor.username },
    );
  }

  /**
   * Step 2.4 — canonical Sale completion (единственная команда, НЕ generic PATCH):
   * CAS + commercial snapshot + availability reservation (owner service) +
   * OrderRequested (atomic, retryable outbox). sales.sale.complete permission.
   */
  @Post("sales/:code/complete")
  @RequirePermissions("sales.sale.complete")
  completeSale(@Param("code") code: string, @Body() dto: CompleteSaleDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    assertNoForbiddenKeys(req.body, SALE_COMPLETE_FORBIDDEN_KEYS);
    return this.sales.completeSale(code, dto.expectedVersion, { id: actor.id, username: actor.username });
  }

  @Get("sales")
  @RequirePermissions("sales.sale.read")
  listSales(@Query() query: ListSalesQueryDto) {
    return this.sales.listSales(query);
  }

  @Get("sales/:code")
  @RequirePermissions("sales.sale.read")
  getSale(@Param("code") code: string) {
    return this.sales.getSaleByCode(code);
  }

  @Get("sales/:code/history")
  @RequirePermissions("sales.sale.read")
  saleHistory(@Param("code") code: string, @Query() query: HistoryQueryDto) {
    return this.sales.saleHistory(code, query.page, query.pageSize);
  }
}

/**
 * PHASE 2 STEP 2.2 — Sales Center read models (/api/v1/sales/center/*).
 *
 *  GET /sales/center/kpi    — aggregate counts (sales.kpi.read; no PII/labels)
 *  GET /sales/center/queues — operational status-queue (entity read permission
 *    по ключу queue; oldest-first FIFO; raw entity projection для ролей с read).
 *
 * KPI — ТОЛЬКО count-based operational metrics (ни revenue/GMV/payment/order/
 * booking). Queues — вычисляемые read models, не новые сущности. Агрегатные
 * роли (ANALYST/MARKETER, kpi.read без raw reads) не получают queues.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("sales/center")
export class SalesCenterController {
  constructor(private readonly sales: SalesService) {}

  @Get("kpi")
  @RequirePermissions("sales.kpi.read")
  kpi(@Query() query: KpiQueryDto) {
    return this.sales.centerKpi(query.from, query.to);
  }

  @Get("queues")
  @RequirePermissions((req) => {
    // Permission резолвится по queue-ключу: raw entity read. Невалидный ключ
    // → fallback на lead.read, но DTO (IsIn) всё равно даст 400 до доступа к БД.
    const key = req.query?.queue as string | undefined;
    const def = key ? SALES_QUEUES[key as SalesQueueKey] : undefined;
    return [def ? def.permission : "sales.lead.read"];
  })
  queues(@Query() query: QueueQueryDto) {
    return this.sales.centerQueue(query.queue, query.page, query.pageSize);
  }
}
