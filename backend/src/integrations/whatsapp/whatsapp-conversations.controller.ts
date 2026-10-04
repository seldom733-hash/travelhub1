import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
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

class CustomerSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
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
