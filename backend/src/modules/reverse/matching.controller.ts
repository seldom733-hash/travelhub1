import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { Request } from "express";
import { MatchingService } from "./matching.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys, MATCH_RUN_FORBIDDEN_KEYS } from "../../shared/field-validation";

class MatchRunDto {
  @IsString()
  @IsNotEmpty()
  buyerRequestId!: string;
}

class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/**
 * PHASE 2 STEP 2.2C — Matching & Distribution.
 *
 * - POST /system/reverse/matching/run — системная команда (reverse.match.run,
 *   только ADMIN): server-authoritative distribution. Body: buyerRequestId
 *   ТОЛЬКО; forged sellerIds/status/timestamps/rank/contactDisclosed → 422.
 * - GET /partner/reverse/distributions — Seller own inbox (own-scope, без
 *   global list; unmatched Seller видит пусто/404).
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post("system/reverse/matching/run")
  @RequirePermissions("reverse.match.run")
  runMatching(@Body() dto: MatchRunDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body — explicit deny: Seller может НЕ добавлять себя, не форджить
    // target sellers/status/timestamps/rank/score/contactDisclosed (→ 422).
    assertNoForbiddenKeys(req.body, MATCH_RUN_FORBIDDEN_KEYS);
    return this.matching.runMatching(actor, dto.buyerRequestId);
  }

  @Get("partner/reverse/distributions")
  @RequirePermissions("reverse.distribution.read_own")
  listOwn(@CurrentUser() actor: AuthedRequest["user"], @Query() query: ListQueryDto) {
    return this.matching.listOwnDistributions(actor, query.limit ?? 50, query.offset ?? 0);
  }

  @Get("partner/reverse/distributions/:id")
  @RequirePermissions("reverse.distribution.read_own")
  getOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.matching.getOwnDistribution(actor, id);
  }
}
