import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, DomainError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import { WHATSAPP_CONFIG } from "../whatsapp.tokens";
import type { WhatsAppConfig } from "../whatsapp.config";
import type { WhatsAppConnectionSnapshot } from "../provider/whatsapp-provider";
import { AuthStateStore } from "../provider/baileys/auth-state-store";
import { WhatsAppSessionRegistryService, type WhatsAppSessionContext } from "./session-registry.service";

/**
 * M2: оркестрация жизненного цикла WhatsApp-сессии (§6.2/§6.4).
 *
 * M5 multi-number: все операции принимают accountId (legacy-вызовы без
 * идентификатора работают с primary-номером — первый активный по createdAt).
 * Провайдер/ownership берутся из реестра (per-account контексты):
 *
 *  - connect: ensureOwnership (CAS/fencing) → provider.start();
 *  - logout/session-reset — только после assertActive(); session-reset
 *    уничтожает ЛОКАЛЬНЫЙ auth-state КОНКРЕТНОГО НОМЕРА (wipe), не дёргая
 *    сервер;
 *  - archive — мягкое отключение (M5): stop + wipe + release + снятие
 *    контекста + archivedAt; строка и история диалогов сохраняются;
 *  - каждый state-change персистится в WhatsAppAccount номера — источник
 *    правды для status-эндпоинта и UI;
 *  - audit-события §6.4: whatsapp.connected / .disconnected / .logout /
 *    .session_reset / whatsapp.archived (БЕЗ QR, кредов и телефона);
 *  - self-fencing: потеря lease → гасим провайдер НОМЕРА (никаких lifecycle/
 *    auth операций без аренды);
 *  - autoConnect (WHATSAPP_AUTO_CONNECT) — по всем активным номерам со
 *    стаггером (~2s), только при enabled.
 */

export interface WhatsAppStatusDto {
  readonly enabled: boolean;
  readonly provider: string;
  readonly state: string;
  readonly phone: string | null;
  readonly connectedAt: Date | null;
  readonly lastDisconnectedAt: Date | null;
  readonly lastError: string | null;
  readonly instanceId: string | null;
  readonly hasQr: boolean;
  readonly autoConnect: boolean;
  readonly reconnect: {
    readonly enabled: boolean;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly maxAttempts: number;
  };
}

export interface ActorAuditRef {
  /** null = системный актор без User-строки (auto-connect) — AuditLog.userId
   * остаётся NULL вместо фиктивного id (иначе FK AuditLog_userId_fkey). */
  readonly id: string | null;
  readonly username?: string | null;
}

/** Пауза между автоподключениями разных номеров (анти-flood / ban-risk). */
const AUTO_CONNECT_STAGGER_MS = 2_000;

@Injectable()
export class WhatsAppSessionRuntimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeLost: (() => void) | null = null;
  private shutdownRequested = false;
  /** Сериализация персистов: события должны применяться в порядке
   *  emission, иначе параллельные update перезапишут state старым значением. */
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    private readonly registry: WhatsAppSessionRegistryService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) return;
    this.unsubscribeState = this.registry.onStateChange((accountId, snapshot) => {
      this.enqueuePersist(() => this.persistSnapshot(accountId, snapshot));
    });
    // Self-fencing: потеря lease гасит транспорт НОМЕРА (auth/lifecycle —
    // fail-closed) и помечает строку Account в ERROR.
    this.unsubscribeLost = this.registry.onLost((accountId, reason) => {
      const ctx = this.registry.get(accountId);
      void ctx?.provider.stop("lease lost").catch((error: unknown) => {
        console.error("[whatsapp] provider stop on lease loss failed", {
          accountId,
          error: error instanceof Error ? error.message : "unknown",
        });
      });
      this.enqueuePersist(() => this.persistSystemError(accountId, reason));
    });
    // autoConnect только на worker/all-инстансах (WHATSAPP_ROLE=api не
    // держит lease автоматически). Подключения разных номеров идут со
    // стаггером (§M5: не более одного паринга одновременно).
    if (this.config.autoConnect && this.config.role !== "api") {
      void this.autoConnectAll().catch((error: unknown) => {
        console.error("[whatsapp] auto-connect failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutdownRequested = true;
    this.unsubscribeState?.();
    this.unsubscribeLost?.();
    this.unsubscribeState = null;
    this.unsubscribeLost = null;
    // Остановка провайдеров — ответственность реестра (registry.dispose).
  }

  // ── §6.4 legacy-эндпоинты (без accountId → primary-номер) ────────────────

  /** §6.4 GET /status — live-снимок (или строка БД, когда фича выключена). */
  async getStatus(accountId?: string | null): Promise<WhatsAppStatusDto> {
    if (!this.config.enabled) {
      return this.statusDto(null, undefined);
    }
    const id = accountId ?? (await this.registry.ensurePrimaryAccountId());
    const row = await this.registry.getAccount(id);
    if (!row) throw new NotFoundError(`WhatsApp account ${id} not found`);
    const snapshot = this.registry.get(id)?.provider.getSnapshot();
    return this.statusDto(row, snapshot);
  }

  /**
   * §6.4 GET /qr — QR только в ответе на явный запрос; не логируется, не
   * аудируется, не персистится. Доступен только в state=QR_REQUIRED.
   */
  async getQr(accountId?: string | null): Promise<string> {
    this.assertEnabled();
    const ctx = await this.resolveContext(accountId);
    const snapshot = ctx.provider.getSnapshot();
    if (snapshot.state !== "QR_REQUIRED" || !snapshot.qr) {
      throw new ConflictError(`QR is not available (state=${snapshot.state})`);
    }
    return snapshot.qr;
  }

  /** §6.4 POST /connect — pairing (явное подтверждение обязательно). */
  async connect(actor: ActorAuditRef, confirm: boolean, accountId?: string | null): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "connect (pairing)");
    this.assertEnabled();
    const ctx = await this.resolveContext(accountId);
    const handle = await ctx.ownership.ensureOwnership(); // fencing до lifecycle
    await ctx.provider.start();
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.connected",
      resource: "WhatsAppAccount",
      resourceId: ctx.accountId,
      details: { instanceId: handle.instanceId, fencingToken: handle.fencingToken },
    });
    return this.getStatus(ctx.accountId);
  }

  /** §6.4 POST /disconnect — остановить транспорт (lease сохраняется). */
  async disconnect(actor: ActorAuditRef, accountId?: string | null): Promise<WhatsAppStatusDto> {
    this.assertEnabled();
    const ctx = await this.resolveContext(accountId);
    await ctx.ownership.assertActive(); // fencing до lifecycle-операции
    await ctx.provider.stop("manual disconnect");
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.disconnected",
      resource: "WhatsAppAccount",
      resourceId: ctx.accountId,
      details: { reason: "manual disconnect" },
    });
    return this.getStatus(ctx.accountId);
  }

  /** §6.4 POST /logout — уничтожить сессию и на сервере, и на диске. */
  async logout(actor: ActorAuditRef, confirm: boolean, accountId?: string | null): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "logout");
    this.assertEnabled();
    const ctx = await this.resolveContext(accountId);
    const handle = await ctx.ownership.assertActive(); // fencing до auth-операции
    await ctx.provider.logout();
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.logout",
      resource: "WhatsAppAccount",
      resourceId: ctx.accountId,
      details: { instanceId: handle.instanceId, fencingToken: handle.fencingToken },
    });
    return this.getStatus(ctx.accountId);
  }

  /**
   * §6.4 POST /session-reset — уничтожить ЛОКАЛЬНУЮ сохранённую сессию
   * НОМЕРА (wipe auth-state; серверная сессия не трогается). Следующий
   * connect начнёт pairing заново (свежий QR).
   */
  async sessionReset(actor: ActorAuditRef, confirm: boolean, accountId?: string | null): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "session-reset");
    this.assertEnabled();
    const ctx = await this.resolveContext(accountId);
    const handle = await ctx.ownership.assertActive(); // fencing до auth-операции
    await ctx.provider.stop("session reset");
    const store = new AuthStateStore({
      sessionPath: ctx.sessionPath,
      encryptionKeyMaterial: this.config.authEncryptionKey,
    });
    await store.wipe(handle.fencingToken);
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.session_reset",
      resource: "WhatsAppAccount",
      resourceId: ctx.accountId,
      details: { instanceId: handle.instanceId, wipedLocalSession: true },
    });
    return this.getStatus(ctx.accountId);
  }

  /**
   * M5 POST /whatsapp/sessions/:id/archive — мягкое архивирование номера:
   * stop + wipe кредов + release lease + снятие контекста + archivedAt.
   * История диалогов/сообщений сохраняется (строка Account не удаляется).
   */
  async archive(
    actor: ActorAuditRef,
    confirm: boolean,
    accountId: string,
  ): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "archive");
    this.assertEnabled();
    const row = await this.registry.getAccount(accountId);
    if (!row) throw new NotFoundError(`WhatsApp account ${accountId} not found`);
    if (row.archivedAt) return this.statusDto(row, undefined);
    const ctx = await this.registry.ensureContext(accountId);
    const handle = await ctx.ownership.ensureOwnership(); // fencing до wipe
    await ctx.provider.stop("archived");
    const store = new AuthStateStore({
      sessionPath: ctx.sessionPath,
      encryptionKeyMaterial: this.config.authEncryptionKey,
    });
    await store.wipe(handle.fencingToken);
    await this.registry.removeContext(accountId, "archived"); // unsubs + release
    const updated = await this.prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { archivedAt: new Date(), state: "DISCONNECTED", lastError: null },
    });
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.archived",
      resource: "WhatsAppAccount",
      resourceId: accountId,
      details: { wipedLocalSession: true },
    });
    return this.statusDto(updated, undefined);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private assertEnabled(): void {
    if (!this.config.enabled) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }
  }

  private assertConfirm(confirm: boolean, action: string): void {
    if (confirm !== true) {
      throw new ValidationDomainError(`${action} requires explicit confirmation (confirm=true)`);
    }
  }

  /** accountId вызова → контекст номера (legacy → primary). */
  private async resolveContext(accountId?: string | null): Promise<WhatsAppSessionContext> {
    this.assertEnabled();
    const id = accountId ?? (await this.registry.ensurePrimaryAccountId());
    return this.registry.ensureContext(id);
  }

  private statusDto(
    row: {
      state: string;
      phone: string | null;
      connectedAt: Date | null;
      lastDisconnectedAt: Date | null;
      lastError: string | null;
    } | null,
    snapshot: WhatsAppConnectionSnapshot | undefined,
  ): WhatsAppStatusDto {
    const state = snapshot?.state ?? row?.state ?? "DISCONNECTED";
    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      state,
      phone: snapshot?.phone ?? row?.phone ?? null,
      connectedAt: snapshot?.connectedAt ?? row?.connectedAt ?? null,
      lastDisconnectedAt: row?.lastDisconnectedAt ?? null,
      lastError: snapshot?.lastError ?? row?.lastError ?? null,
      instanceId: snapshot?.instanceId ?? null,
      hasQr: (snapshot?.qr ?? null) !== null,
      autoConnect: this.config.autoConnect,
      reconnect: {
        enabled: this.config.reconnectEnabled,
        baseDelayMs: this.config.reconnectBaseDelayMs,
        maxDelayMs: this.config.reconnectMaxDelayMs,
        maxAttempts: this.config.maxReconnectAttempts,
      },
    };
  }

  /** Персист state-снимка номера (порядок — через FIFO-очередь). */
  private async persistSnapshot(accountId: string, snapshot: WhatsAppConnectionSnapshot): Promise<void> {
    try {
      const row = await this.registry.getAccount(accountId);
      const data = {
        state: snapshot.state,
        phone: snapshot.phone,
        connectedAt: snapshot.connectedAt,
        lastDisconnectedAt:
          snapshot.state === "DISCONNECTED" ? new Date() : (row?.lastDisconnectedAt ?? null),
        lastError: snapshot.lastError,
      };
      if (row) {
        await this.prisma.whatsAppAccount.update({ where: { id: row.id }, data });
      }
    } catch (error) {
      console.error("[whatsapp] account state persist failed", {
        accountId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async persistSystemError(accountId: string, reason: string): Promise<void> {
    try {
      await this.prisma.whatsAppAccount.updateMany({
        where: { id: accountId },
        data: { state: "ERROR", lastError: reason },
      });
    } catch (error) {
      console.error("[whatsapp] lease-loss persist failed", {
        accountId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  /** FIFO-очередь персистов (порядок state-событий сохраняется). */
  private enqueuePersist(task: () => Promise<void>): void {
    this.persistQueue = this.persistQueue.then(task).catch((error: unknown) => {
      console.error("[whatsapp] queued persist failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  /** Подключения активных номеров со стаггером (первый — сразу). */
  private async autoConnectAll(): Promise<void> {
    await this.registry.ready();
    if (this.shutdownRequested) return;
    const accounts = await this.registry.listActiveAccounts();
    for (let index = 0; index < accounts.length; index++) {
      if (this.shutdownRequested) return;
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, AUTO_CONNECT_STAGGER_MS));
      if (this.shutdownRequested) return;
      const account = accounts[index]!;
      try {
        await this.connect({ id: null, username: "system" }, true, account.id);
      } catch (error) {
        console.error("[whatsapp] auto-connect failed", {
          accountId: account.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }
}
