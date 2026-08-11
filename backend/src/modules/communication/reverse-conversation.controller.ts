import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Request } from "express";
import { ReverseConversationService } from "./reverse-conversation.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import {
  assertNoForbiddenKeys,
  CONVERSATION_OPEN_FORBIDDEN_KEYS,
  CONVERSATION_SEND_FORBIDDEN_KEYS,
} from "../../shared/field-validation";

/** Open/get canonical conversation: BuyerRequest + Buyer + Seller [+ Proposal]. */
class OpenConversationDto {
  @IsString()
  @IsNotEmpty()
  buyerRequestId!: string;

  /** Только для BUYER: SELL-* publicId Seller-а (сервер резолвит partnerId). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  sellerPublicId?: string;
}

/** Send: только body (+ subject). Всё остальное — server-derived. */
class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}

class PaginationQueryDto {
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
 * PHASE 2 STEP 2.2E — pre-sale conversations (communication.CommunicationThread).
 *
 * Владелец API — Communication (НЕ reverse): переиспользование существующего
 * контура с Reverse Marketplace контекстом (§25). Никакого второго chat-домена.
 *
 * Ownership: actor.customerId / actor.partnerId — единственные security sources;
 * body/query НЕ являются security source (forged sellerId/buyerId/memberIds/
 * proposalId/status/version/timestamps → 422; чужой id → neutral 404).
 *
 * - open/send — communication.write_own (BUYER + PARTNER);
 * - list/detail/messages — communication.read_own (BUYER + PARTNER).
 */
@Controller("communications/reverse/conversations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReverseConversationController {
  constructor(private readonly conversations: ReverseConversationService) {}

  @Post()
  @RequirePermissions("communication.write_own")
  open(@Body() dto: OpenConversationDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body — explicit deny forged ownership/membership/context/sales/actor.
    assertNoForbiddenKeys(req.body, CONVERSATION_OPEN_FORBIDDEN_KEYS);
    return this.conversations.open(actor, { buyerRequestId: dto.buyerRequestId, sellerPublicId: dto.sellerPublicId });
  }

  @Get()
  @RequirePermissions("communication.read_own")
  list(@CurrentUser() actor: AuthedRequest["user"], @Query() query: PaginationQueryDto) {
    return this.conversations.list(actor, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(":id")
  @RequirePermissions("communication.read_own")
  detail(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.conversations.get(actor, id);
  }

  @Get(":id/messages")
  @RequirePermissions("communication.read_own")
  listMessages(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string, @Query() query: PaginationQueryDto) {
    return this.conversations.listMessages(actor, id, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post(":id/messages")
  @RequirePermissions("communication.write_own")
  send(@Body() dto: SendMessageDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    // Raw body — explicit deny: sender/recipient/direction/ownership/temporal → 422.
    assertNoForbiddenKeys(req.body, CONVERSATION_SEND_FORBIDDEN_KEYS);
    return this.conversations.send(actor, id, { body: dto.body, subject: dto.subject });
  }
}
