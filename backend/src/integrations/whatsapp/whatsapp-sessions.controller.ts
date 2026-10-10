import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { SecurityService } from "../../security/security.service";
import { DomainError, NotFoundError } from "../../shared/errors";
import { WHATSAPP_CONFIG } from "./whatsapp.tokens";
import type { WhatsAppConfig } from "./whatsapp.config";
import { QrRateLimiter } from "./qr-rate-limit";
import { WhatsAppSessionRuntimeService } from "./session/session-runtime.service";
import { WhatsAppSessionRegistryService } from "./session/session-registry.service";

/**
 * M5 multi-number §-API: управление несколькими WhatsApp-номерами.
 *
 *  - GET    /whatsapp/sessions                 whatsapp.read           (список + status)
 *  - POST   /whatsapp/sessions                 whatsapp.session.admin  (новый номер)
 *  - GET    /whatsapp/sessions/:id             whatsapp.read           (один + status)
 *  - GET    /whatsapp/sessions/:id/qr          whatsapp.session.admin  (+ rate-limit)
 *  - POST   /whatsapp/sessions/:id/connect     whatsapp.session.admin  (confirm)
 *  - POST   /whatsapp/sessions/:id/disconnect  whatsapp.session.admin
 *  - POST   /whatsapp/sessions/:id/archive     whatsapp.session.admin  (confirm; история цела)
 *
 * Legacy-роуты (/whatsapp/status|qr|connect|…) остаются на primary-номере.
 */

class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;
}

class ConfirmDto {
  @IsBoolean()
  confirm!: boolean;
}

@Controller("whatsapp/sessions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhatsAppSessionsController {
  private readonly qrLimiter: QrRateLimiter;

  constructor(
    @Inject(WHATSAPP_CONFIG) config: WhatsAppConfig,
    private readonly registry: WhatsAppSessionRegistryService,
    private readonly runtime: WhatsAppSessionRuntimeService,
    private readonly security: SecurityService,
  ) {
    this.qrLimiter = new QrRateLimiter(config);
  }

  @Get()
  @RequirePermissions("whatsapp.read")
  async list() {
    const rows = await this.registry.listAccounts();
    const accounts = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        status: await this.runtime.getStatus(row.id),
      })),
    );
    return { accounts };
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions("whatsapp.session.admin")
  async create(@Body() dto: CreateSessionDto, @CurrentUser() actor: AuthedRequest["user"]) {
    if (!this.registry.enabled) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }
    const account = await this.registry.createAccount(dto.label);
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.account_created",
      resource: "WhatsAppAccount",
      resourceId: account.id,
      details: { provider: account.provider, label: account.label },
    });
    return { account: { ...account, status: await this.runtime.getStatus(account.id) } };
  }

  @Get(":id")
  @RequirePermissions("whatsapp.read")
  async get(@Param("id") id: string) {
    const row = await this.registry.getAccount(id);
    if (!row) throw new NotFoundError(`WhatsApp account ${id} not found`);
    return { account: { ...row, status: await this.runtime.getStatus(row.id) } };
  }

  @Get(":id/qr")
  @RequirePermissions("whatsapp.session.admin")
  async qr(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    this.qrLimiter.hit(actor.id);
    // QR возвращается ТОЛЬКО здесь: без логирования, без audit, без записи в БД.
    return { qr: await this.runtime.getQr(id) };
  }

  @Post(":id/connect")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  connect(@Param("id") id: string, @Body() dto: ConfirmDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.connect(actor, dto.confirm, id);
  }

  @Post(":id/disconnect")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  disconnect(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.disconnect(actor, id);
  }

  @Post(":id/archive")
  @HttpCode(200)
  @RequirePermissions("whatsapp.session.admin")
  archive(@Param("id") id: string, @Body() dto: ConfirmDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.runtime.archive(actor, dto.confirm, id);
  }
}
