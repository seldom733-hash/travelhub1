import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { WhatsAppConversationsService } from "./conversations/conversations.service";
import type { WhatsAppMatchingStatus } from "../../generated/prisma/enums";

/**
 * M3 §25: REST операционного inbox диалогов WhatsApp.
 *
 *  - GET  whatsapp/conversations                    whatsapp.read
 *         (?limit, ?matchingStatus=UNMATCHED|MATCHED|AMBIGUOUS — §25
 *          unmatched/ambiguous-списки реализованы фильтром списка)
 *  - GET  whatsapp/conversations/:id                whatsapp.read
 *         (customer, AMBIGUOUS-кандидаты, контекст §13, suppression)
 *  - GET  whatsapp/conversations/:id/messages       whatsapp.read (timeline §14)
 *  - POST whatsapp/conversations/:id/customer       whatsapp.manage
 *         (link-customer / resolve: ручной выбор Customer + audit §24)
 *  - POST whatsapp/conversations/:id/phone           whatsapp.manage
 *         (§10 LID→PN: ручной бинд номера к lid-диалогу без Customer)
 *  - DELETE whatsapp/conversations/:id/customer     whatsapp.manage
 *         (M4.2 unlink: снятие связи Customer ↔ диалог + audit;
 *          история не переписывается, идемпотентно)
 *  - POST whatsapp/conversations/:id/onboard        whatsapp.manage
 *         (M4.4 §18 first contact: collect info → re-resolve → create/reuse
 *          Customer → link → optional activation, без форса регистрации)
 *  - POST whatsapp/conversations/:id/read           whatsapp.read (unread §18)
 *  - GET  whatsapp/customer-search?search=          whatsapp.manage
 *         (ручной поиск клиента для link: код/имя/email/телефон)
 */

const MATCHING_STATUSES = ["UNMATCHED", "MATCHED", "AMBIGUOUS"] as const;

class ConversationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(MATCHING_STATUSES)
  matchingStatus?: (typeof MATCHING_STATUSES)[number];

  /** M5: фильтр по номеру (accountId); без него — все номера. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;
}

class TimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

class LinkCustomerDto {
  @IsString()
  @MaxLength(64)
  customerId!: string;
}

/** §10 LID→PN: ручной ввод номера собеседника («Привязать Lid к номеру»). */
class BindPhoneDto {
  @IsString()
  @MaxLength(32)
  phone!: string;
}

class CustomerSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** M4.4 §18: обязательная информация первого контакта = email (unique Customer). */
class OnboardCustomerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  activateUser?: boolean;
}

@Controller("whatsapp")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhatsAppConversationsController {
  constructor(private readonly conversations: WhatsAppConversationsService) {}

  @Get("conversations")
  @RequirePermissions("whatsapp.read")
  list(@Query() query: ConversationsQueryDto) {
    return this.conversations.list(
      query.limit ?? 50,
      query.matchingStatus as WhatsAppMatchingStatus | undefined,
      query.accountId,
    );
  }

  @Get("conversations/:id")
  @RequirePermissions("whatsapp.read")
  detail(@Param("id") id: string) {
    return this.conversations.detail(id);
  }

  @Get("conversations/:id/messages")
  @RequirePermissions("whatsapp.read")
  timeline(@Param("id") id: string, @Query() query: TimelineQueryDto) {
    return this.conversations.timeline(id, query.limit ?? 100);
  }

  @Post("conversations/:id/customer")
  @HttpCode(200)
  @RequirePermissions("whatsapp.manage")
  linkCustomer(
    @Param("id") id: string,
    @Body() dto: LinkCustomerDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.conversations.linkCustomer(id, dto.customerId, actor);
  }

  /** §10 LID→PN: бинд номера к lid-диалогу (без Customer; audit §24). */
  @Post("conversations/:id/phone")
  @HttpCode(200)
  @RequirePermissions("whatsapp.manage")
  bindPhone(
    @Param("id") id: string,
    @Body() dto: BindPhoneDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.conversations.bindPhone(id, dto.phone, actor);
  }

  /** M4.2: unlink (снятие связи + audit; идемпотентно, история не меняется). */
  @Delete("conversations/:id/customer")
  @RequirePermissions("whatsapp.manage")
  unlinkCustomer(
    @Param("id") id: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.conversations.unlinkCustomer(id, actor);
  }

  /**
   * M4.4 §18: onboarding первого контакта — collect info → re-resolve →
   * create/reuse Customer → link → optional activation (механика §19,
   * delivery отложен; registration не форсируется).
   */
  @Post("conversations/:id/onboard")
  @HttpCode(200)
  @RequirePermissions("whatsapp.manage")
  onboardCustomer(
    @Param("id") id: string,
    @Body() dto: OnboardCustomerDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.conversations.onboardCustomer(id, dto, actor);
  }

  @Post("conversations/:id/read")
  @HttpCode(200)
  @RequirePermissions("whatsapp.read")
  markRead(@Param("id") id: string) {
    return this.conversations.markRead(id);
  }

  /** §25: ручной поиск клиента для link (без CRM Marketplace-scope фильтра). */
  @Get("customer-search")
  @RequirePermissions("whatsapp.manage")
  searchCustomers(@Query() query: CustomerSearchQueryDto) {
    return this.conversations.searchCustomers(query.search ?? "");
  }
}
