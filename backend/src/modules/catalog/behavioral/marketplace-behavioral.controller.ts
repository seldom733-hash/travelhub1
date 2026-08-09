import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { IsIn, IsISO8601, IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { Request } from "express";
import { Public } from "../../../security/auth/decorators";
import { assertNoForbiddenKeys } from "../../../shared/field-validation";
import { EVENT_LOCALES } from "./marketplace-behavioral.contracts";
import { MarketplaceBehavioralService } from "./marketplace-behavioral.service";

/**
 * DTO Marketplace behavioral event (Step 1.13B §10/§11): строгий whitelist.
 * eventId — client UUID (dedup); occurredAt — client UTC (skew-окно на сервере);
 * sessionId — opaque non-PII; locale/path — контекст. productId/categoryId/
 * partnerId/sellerId/storefrontId/acquisitionSource/authenticatedUserId/actor-
 * поля и contact values запрещены (raw-body check + DTO whitelist). payload —
 * валидируется по eventType в сервисе (без arbitrary JSON); search query —
 * только через privacy-normalizer.
 */
class MarketplaceBehavioralEventDto {
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
  @IsString()
  @MaxLength(200)
  categorySlug?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

/**
 * PHASE 1 STEP 1.13B §10 — public ingestion endpoint Marketplace (anonymous,
 * без Authorization; если Authorization приложен — не обязательна и не читается).
 * Ответ 202 с минимальным телом ({ accepted: true }): ни internal state, ни
 * echo контактных значений. Непубличные ресурсы → нейтральный 202 (silent
 * drop); duplicate eventId → 202 (dedup); синтаксически невалидные → 4xx.
 */
@Controller("public/marketplace")
export class MarketplaceBehavioralController {
  constructor(private readonly behavioral: MarketplaceBehavioralService) {}

  @Post("events")
  @Public()
  @HttpCode(202)
  ingest(@Body() dto: MarketplaceBehavioralEventDto, @Req() req: Request) {
    // Raw body (не срезан ValidationPipe) — explicit deny forged envelope /
    // contact values / internal identity (422, а не silent strip).
    assertNoForbiddenKeys(req.body, this.behavioral.forbiddenKeys());
    return this.behavioral.ingest(dto);
  }
}
