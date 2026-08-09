import { Body, Controller, HttpCode, Param, Post, Req } from "@nestjs/common";
import { IsIn, IsISO8601, IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { Request } from "express";
import { Public } from "../../../security/auth/decorators";
import { assertNoForbiddenKeys } from "../../../shared/field-validation";
import { EVENT_LOCALES, STOREFRONT_EVENT_FORBIDDEN_KEYS } from "./storefront-behavioral.contracts";
import { StorefrontBehavioralService } from "./storefront-behavioral.service";

/**
 * DTO behavioral event (Step 1.12.3 §4/§9): строгий whitelist.
 * eventId — client UUID (dedup); occurredAt — client UTC (skew-окно на сервере);
 * sessionId — opaque non-PII; locale/path — контекст. storefrontId/productId/
 * partnerId/acquisitionSource/authenticatedUserId/actor-поля и contact values
 * запрещены (raw-body check + DTO whitelist). payload — валидируется по
 * eventType в сервисе (без arbitrary JSON).
 */
class StorefrontBehavioralEventDto {
  @IsUUID()
  eventId!: string;

  @IsString()
  @MaxLength(40)
  eventType!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsIn(EVENT_LOCALES as unknown as string[])
  locale!: string;

  @IsString()
  @MaxLength(300)
  path!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productSlug?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

/**
 * PHASE 1 STEP 1.12.3 §9 — public ingestion endpoint (anonymous, без
 * Authorization; если Authorization приложен — не обязательна и не читается).
 * Ответ 202 с минимальным телом ({ accepted: true }): ни internal state, ни
 * echo контактных значений. Непубличные ресурсы → нейтральный 202 (silent
 * drop); duplicate eventId → 202 (dedup); синтаксически невалидные → 4xx.
 */
@Controller("public/storefronts")
export class StorefrontBehavioralController {
  constructor(private readonly behavioral: StorefrontBehavioralService) {}

  @Post(":slug/events")
  @Public()
  @HttpCode(202)
  ingest(@Param("slug") slug: string, @Body() dto: StorefrontBehavioralEventDto, @Req() req: Request) {
    // Raw body (не срезан ValidationPipe) — explicit deny forged envelope /
    // contact values / internal identity (422, а не silent strip).
    assertNoForbiddenKeys(req.body, STOREFRONT_EVENT_FORBIDDEN_KEYS);
    return this.behavioral.ingest(slug, dto);
  }
}
