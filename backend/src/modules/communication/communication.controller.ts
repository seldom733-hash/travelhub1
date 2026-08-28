import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Request } from "express";
import { CommunicationService } from "./communication.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { COMMUNICATION_CREATE_FORBIDDEN_KEYS } from "./communication.validation";
import {
  CommunicationContextType,
  CommunicationDirection,
  CommunicationParticipantType,
  CommunicationType,
  RoleCode,
} from "../../generated/prisma/enums";

/** Typed participant ref (§12): SYSTEM без id; USER/CUSTOMER/PARTNER — с id. */
class ParticipantDto {
  @IsEnum(CommunicationParticipantType)
  type!: CommunicationParticipantType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;
}

/** Create-контракт (внутренний персонал). Валидация whitelist режет всё лишнее. */
class CreateCommunicationDto {
  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @IsEnum(CommunicationDirection)
  direction!: CommunicationDirection;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsEnum(CommunicationContextType)
  contextType!: CommunicationContextType;

  @IsString()
  @MaxLength(64)
  contextId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParticipantDto)
  sender?: ParticipantDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParticipantDto)
  recipient?: ParticipantDto;
}

/** Внутренний список: фильтры (§40) + пагинация (§39). */
class ListCommunicationsQuery {
  @IsOptional()
  @IsEnum(CommunicationContextType)
  contextType?: CommunicationContextType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contextId?: string;

  @IsOptional()
  @IsEnum(CommunicationType)
  type?: CommunicationType;

  @IsOptional()
  @IsEnum(CommunicationDirection)
  direction?: CommunicationDirection;

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

/** Own-scope список (BUYER/PARTNER): только пагинация — scope всегда из actor. */
class OwnCommunicationsQuery {
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
 * PHASE 1 STEP 1.16 — /api/v1/communications.
 *
 * Объектный scope ВСЕГДА из actor (JWT): customerId/partnerId/contextId из
 * body/query не являются security source (forged → 422/neutral 404, §35/§26).
 * - create/list/detail — internal staff (communication.create/read);
 * - own — BUYER/PARTNER own-scope (communication.read_own);
 * - detail: internal staff → любой; BUYER/PARTNER → own-scope, иначе neutral 404.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("communications")
export class CommunicationController {
  constructor(private readonly communications: CommunicationService) {}

  @Post()
  @RequirePermissions("communication.create")
  create(@Body() dto: CreateCommunicationDto, @CurrentUser() actor: AuthedRequest["user"], @Req() req: Request) {
    // Raw body (не срезан ValidationPipe) — явное отклонение mass-assignment:
    // code/status/actorUserId/occurredAt/timestamps/correlation нельзя forged.
    assertNoForbiddenKeys(req.body, COMMUNICATION_CREATE_FORBIDDEN_KEYS);
    return this.communications.create(
      {
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        body: dto.body,
        contextType: dto.contextType,
        contextId: dto.contextId,
        sender: dto.sender,
        recipient: dto.recipient,
      },
      { id: actor.id, username: actor.username },
    );
  }

  @Get()
  @RequirePermissions("communication.read")
  list(@Query() query: ListCommunicationsQuery) {
    return this.communications.list({
      contextType: query.contextType,
      contextId: query.contextId,
      type: query.type,
      direction: query.direction,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get("own")
  @RequirePermissions("communication.read_own")
  own(@CurrentUser() actor: AuthedRequest["user"], @Query() query: OwnCommunicationsQuery) {
    return this.communications.getOwn(actor, query.page, query.pageSize);
  }

  /** Step 3.7B — List communications for a specific business context. */
  @Get("context/:contextType/:contextId")
  @RequirePermissions("communication.read_own")
  listByContext(
    @Param("contextType") contextType: string,
    @Param("contextId") contextId: string,
    @CurrentUser() actor: AuthedRequest["user"],
    @Query() query: OwnCommunicationsQuery,
  ) {
    if (!Object.values(CommunicationContextType).includes(contextType as CommunicationContextType)) {
      throw new (require("../../shared/errors").ValidationDomainError)("Unsupported context type");
    }
    return this.communications.listByBusinessContext(
      contextType as CommunicationContextType,
      contextId,
      actor,
      query.page,
      query.pageSize,
    );
  }

  @Get(":code")
  @RequirePermissions((req) =>
    req.user.role === RoleCode.BUYER || req.user.role === RoleCode.PARTNER
      ? ["communication.read_own"]
      : ["communication.read"],
  )
  detail(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.communications.getByCode(code, actor);
  }
}
