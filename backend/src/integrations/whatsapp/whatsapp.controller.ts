import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { Idempotent } from "../../shared/idempotency/idempotency.decorator";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { NotFoundError, ValidationDomainError } from "../../shared/errors";
import { WHATSAPP_CONFIG } from "./whatsapp.tokens";
import type { WhatsAppConfig } from "./whatsapp.config";
import { QrRateLimiter } from "./qr-rate-limit";
import { WhatsAppSessionRuntimeService } from "./session/session-runtime.service";
import { WhatsAppOutboundService, type WhatsAppRecoverAction } from "./outbound/outbound.service";
import { WhatsAppInboundService } from "./inbound/inbound.service";
import { WhatsAppMediaStorage } from "./media/whatsapp-media.storage";

/**
 * §6.4 REST API управления WhatsApp-сессией.
 *
 * Маршруты/права/audit ровно по master-промпту §6.4:
 *  - GET  status                         whatsapp.read
 *  - GET  qr                             whatsapp.session.admin (+ rate-limit)
 *  - POST connect | disconnect           whatsapp.session.admin (pairing — confirm)
 *  - POST logout | session-reset         whatsapp.session.admin (+ confirm, audit)
 *  - POST messages                       whatsapp.send (+ Idempotency-Key)
 *  - POST messages/:id/recover           whatsapp.send.recover
 *  - GET  messages                       whatsapp.read (операционный список)
 *
 * contacts/:id/link|unlink (whatsapp.manage) — вне scope M2 (inbound/CRM,
 * запрещено решением владельца; подключается на M3+).
 *
 * Безопасность: raw body deny-list (никаких client-производных статусов/
 * providerMessageId/fencing), QR не логируется и не аудируется, телефон
 * не попадает в audit/логи.
 */

const SEND_FORBIDDEN_KEYS = [
  "status",
  "providerMessageId",
  "operationKey",
  "communicationId",
  "accountId",
  "fencingToken",
  "recipientJid",
  "attempts",
  "lastError",
  "sentAt",
  "deliveredAt",
  "readAt",
  "nextAttemptAt",
  "createdAt",
  "updatedAt",
  "channel",
  "direction",
] as const;

class ConfirmDto {
  @IsBoolean()
  confirm!: boolean;
}

class SendManualDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  /** M3+: без uploadId текст обязателен; с файлом — опциональный caption. */
  @ValidateIf((dto: SendManualDto) => !dto.uploadId)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  /** M3 §19: диалог операционного inbox (опционально; проверяется сервисом). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;

  /** M3+: uploadId из POST /whatsapp/uploads (файл уходит document). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  uploadId?: string;
}

const RECOVER_ACTIONS = ["reconcile", "mark-failed", "retry-anyway"] as const;

class RecoverDto {
  @IsIn(RECOVER_ACTIONS)
  action!: (typeof RECOVER_ACTIONS)[number];

  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

class MessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller("whatsapp")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhatsAppController {
  private readonly qrLimiter: QrRateLimiter;
  private readonly media: WhatsAppMediaStorage;

  constructor(
    @Inject(WHATSAPP_CONFIG) config: WhatsAppConfig,
    private readonly runtime: WhatsAppSessionRuntimeService,
    private readonly outbound: WhatsAppOutboundService,
    private readonly inbound: WhatsAppInboundService,
  ) {
    this.qrLimiter = new QrRateLimiter(config);
    this.media = new WhatsAppMediaStorage(config.mediaDir ?? ".whatsapp-media");
  }

  @Get("status")
  @RequirePermissions("whatsapp.read")
  status() {
    return this.runtime.getStatus();
  }

  @Get("qr")
  @RequirePermissions("whatsapp.session.admin")
  async qr(@CurrentUser() actor: AuthedRequest["user"]) {
    this.qrLimiter.hit(actor.id);
    // QR возвращается ТОЛЬКО здесь: без логирования, без audit, без записи в БД.
    return { qr: await this.runtime.getQr() };
  }

  @Post("connect")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  connect(@Body() dto: ConfirmDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.connect(actor, dto.confirm);
  }

  @Post("disconnect")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  disconnect(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.disconnect(actor);
  }

  @Post("logout")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  logout(@Body() dto: ConfirmDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.logout(actor, dto.confirm);
  }

  @Post("session-reset")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  sessionReset(@Body() dto: ConfirmDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.sessionReset(actor, dto.confirm);
  }

  @Post("messages")
  @HttpCode(201)
  @Idempotent("whatsapp.send")
  @RequirePermissions("whatsapp.send")
  send(
    @Body() dto: SendManualDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    // Raw body deny: client НЕ управляет статусами/id/fencing/каноном записи.
    assertNoForbiddenKeys(req.body, SEND_FORBIDDEN_KEYS);
    const operationKey = String(req.headers["idempotency-key"] ?? "");
    return this.outbound.sendManual(
      {
        customerId: dto.customerId ?? null,
        phone: dto.phone ?? null,
        text: dto.text ?? "",
        conversationId: dto.conversationId ?? null,
        uploadId: dto.uploadId ?? null,
      },
      actor,
      operationKey,
    );
  }

  /**
   * M3+: staged-загрузка файла (multipart) ДО send. Отдельный endpoint без
   * @Idempotent: multipart-тело не участвует в fingerprint (raw body уже
   * разобран до interceptor'ов → идемпотентный ключ был бы нестабилен).
   */
  @Post("uploads")
  @HttpCode(201)
  @RequirePermissions("whatsapp.send")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file || file.size === 0) {
      throw new ValidationDomainError('File field "file" is required (multipart/form-data)');
    }
    const uploadId = this.media.newUploadId();
    return this.media.stageUpload(
      { originalname: file.originalname, mimetype: file.mimetype, size: file.size, bytes: file.buffer },
      uploadId,
    );
  }

  /**
   * M3+: скачивание вложения диалога (local←local). Cookie/JWT-сессия
   * работает в <img>/<a download> браузера без CORS-заголовков.
   */
  @Get("media/:origin/:id")
  @RequirePermissions("whatsapp.read")
  async mediaFile(
    @Param("origin") origin: string,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    if (origin !== "inbound" && origin !== "outbound") {
      throw new NotFoundError("Unknown media origin");
    }
    const row = origin === "inbound" ? await this.inbound.getMedia(id) : await this.outbound.getMedia(id);
    if (!row?.mediaPath) throw new NotFoundError("Media file not found");
    const bytes = await this.media.readRelative(row.mediaPath);
    if (!bytes) throw new NotFoundError("Media file not found");
    const asciiName = row.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    res.setHeader("Content-Type", row.mimetype ?? "application/octet-stream");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    );
    res.end(bytes);
  }

  @Get("messages")
  @RequirePermissions("whatsapp.read")
  listMessages(@Query() query: MessagesQueryDto) {
    return this.outbound.list(query.limit ?? 50);
  }

  @Post("messages/:id/recover")
  @HttpCode(200)
  @RequirePermissions("whatsapp.send.recover")
  recover(
    @Param("id") id: string,
    @Body() dto: RecoverDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    if (dto.action === "retry-anyway" && dto.confirm !== true) {
      throw new ValidationDomainError(
        "retry-anyway requires explicit confirmation (confirm=true): duplicate delivery is possible",
      );
    }
    return this.outbound.recover(id, dto.action as WhatsAppRecoverAction, { confirm: dto.confirm }, actor);
  }
}
