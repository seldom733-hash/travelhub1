import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, DomainError, ValidationDomainError } from "../../../shared/errors";
import { WHATSAPP_CONFIG, WHATSAPP_PROVIDER } from "../whatsapp.tokens";
import type { WhatsAppConfig } from "../whatsapp.config";
import type { WhatsAppConnectionSnapshot, WhatsAppProvider } from "../provider/whatsapp-provider";
import { AuthStateStore } from "../provider/baileys/auth-state-store";
import { WhatsAppSessionOwnershipService } from "../ownership/session-ownership.service";

/**
 * M2: оркестрация жизненного цикла WhatsApp-сессии (§6.2/§6.4).
 *
 *  - connect: ensureOwnership (CAS/fencing) → provider.start();
 *  - logout/session-reset — только после assertActive(); session-reset
 *    уничтожает ЛОКАЛЬНЫЙ auth-state (wipe), не дёргая сервер;
 *  - каждый state-change персистится в singleton WhatsAppAccount
 *    (state/phone/connectedAt/lastDisconnectedAt/lastError) — источник
 *    правды для status-эндпоинта и UI;
 *  - audit-события §6.4: whatsapp.connected / .disconnected / .logout /
 *    .session_reset (БЕЗ QR, кредов и телефона);
 *  - self-fencing: потеря lease → гасим провайдера (никаких lifecycle/auth
 *    операций без аренды);
 *  - autoConnect (WHATSAPP_AUTO_CONNECT) — только при enabled.
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

interface ActorAuditRef {
  /** null = системный актор без User-строки (auto-connect) — AuditLog.userId
   * остаётся NULL вместо фиктивного id (иначе FK AuditLog_userId_fkey). */
  readonly id: string | null;
  readonly username?: string | null;
}

@Injectable()
export class WhatsAppSessionRuntimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly provider: WhatsAppProvider | null;
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeLost: (() => void) | null = null;
  private shutdownRequested = false;
  /** Сериализация персистов: события должны применяться в порядке
   *  emission, иначе параллельные update перезапишут state старым значением. */
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly ownership: WhatsAppSessionOwnershipService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    @Optional() @Inject(WHATSAPP_PROVIDER) provider: WhatsAppProvider | null,
  ) {
    this.provider = provider;
  }

  onApplicationBootstrap(): void {
    if (!this.config.enabled || !this.provider) return;
    this.unsubscribeState = this.provider.onStateChange((snapshot) => {
      this.enqueuePersist(() => this.persistSnapshot(snapshot));
    });
    // Self-fencing: потеря lease гасит транспорт (auth/lifecycle — fail-closed).
    this.unsubscribeLost = this.ownership.onLost((reason) => {
      void this.provider?.stop("lease lost").catch((error: unknown) => {
        console.error("[whatsapp] provider stop on lease loss failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
      this.enqueuePersist(() => this.persistSystemError(reason));
    });
    // autoConnect только на worker/all-инстансах (WHATSAPP_ROLE=api не
    // держит lease автоматически).
    if (this.config.autoConnect && this.config.role !== "api") {
      void this.connect({ id: null, username: "system" }, true).catch((error: unknown) => {
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
    if (this.provider && this.config.enabled) {
      await this.provider.stop("application shutdown").catch((error: unknown) => {
        console.error("[whatsapp] provider stop on shutdown failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    }
  }

  /** §6.4 GET /status — live-снимок (или строка БД, когда фича выключена). */
  async getStatus(): Promise<WhatsAppStatusDto> {
    const row = await this.ensureAccountRow();
    const snapshot = this.provider?.getSnapshot();
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

  /**
   * §6.4 GET /qr — QR только в ответе на явный запрос; не логируется, не
   * аудируется, не персистится. Доступен только в state=QR_REQUIRED.
   */
  getQr(): string {
    this.assertEnabled();
    const snapshot = this.provider!.getSnapshot();
    if (snapshot.state !== "QR_REQUIRED" || !snapshot.qr) {
      throw new ConflictError(`QR is not available (state=${snapshot.state})`);
    }
    return snapshot.qr;
  }

  /** §6.4 POST /connect — pairing (явное подтверждение обязательно). */
  async connect(actor: ActorAuditRef, confirm: boolean): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "connect (pairing)");
    this.assertEnabled();
    const handle = await this.ownership.ensureOwnership(); // fencing до lifecycle
    await this.provider!.start();
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.connected",
      resource: "WhatsAppAccount",
      resourceId: null,
      details: { instanceId: handle.instanceId, fencingToken: handle.fencingToken },
    });
    return this.getStatus();
  }

  /** §6.4 POST /disconnect — остановить транспорт (lease сохраняется). */
  async disconnect(actor: ActorAuditRef): Promise<WhatsAppStatusDto> {
    this.assertEnabled();
    await this.ownership.assertActive(); // fencing до lifecycle-операции
    await this.provider!.stop("manual disconnect");
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.disconnected",
      resource: "WhatsAppAccount",
      resourceId: null,
      details: { reason: "manual disconnect" },
    });
    return this.getStatus();
  }

  /** §6.4 POST /logout — уничтожить сессию и на сервере, и на диске. */
  async logout(actor: ActorAuditRef, confirm: boolean): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "logout");
    this.assertEnabled();
    const handle = await this.ownership.assertActive(); // fencing до auth-операции
    await this.provider!.logout();
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.logout",
      resource: "WhatsAppAccount",
      resourceId: null,
      details: { instanceId: handle.instanceId, fencingToken: handle.fencingToken },
    });
    return this.getStatus();
  }

  /**
   * §6.4 POST /session-reset — уничтожить ЛОКАЛЬНУЮ сохранённую сессию
   * (wipe auth-state; серверная сессия не трогается). Следующий connect
   * начнёт pairing заново (свежий QR).
   */
  async sessionReset(actor: ActorAuditRef, confirm: boolean): Promise<WhatsAppStatusDto> {
    this.assertConfirm(confirm, "session-reset");
    this.assertEnabled();
    const handle = await this.ownership.assertActive(); // fencing до auth-операции
    await this.provider!.stop("session reset");
    const store = new AuthStateStore({
      sessionPath: this.config.sessionPath,
      encryptionKeyMaterial: this.config.authEncryptionKey,
    });
    await store.wipe(handle.fencingToken);
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.session_reset",
      resource: "WhatsAppAccount",
      resourceId: null,
      details: { instanceId: handle.instanceId, wipedLocalSession: true },
    });
    return this.getStatus();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private assertEnabled(): void {
    if (!this.config.enabled || !this.provider) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }
  }

  private assertConfirm(confirm: boolean, action: string): void {
    if (confirm !== true) {
      throw new ValidationDomainError(`${action} requires explicit confirmation (confirm=true)`);
    }
  }

  private async ensureAccountRow(): Promise<{
    id: string;
    state: string;
    phone: string | null;
    connectedAt: Date | null;
    lastDisconnectedAt: Date | null;
    lastError: string | null;
  } | null> {
    const existing = await this.prisma.whatsAppAccount.findFirst();
    if (existing) return existing;
    if (!this.config.enabled) return null;
    return this.prisma.whatsAppAccount.create({
      data: { provider: this.config.provider, state: "DISCONNECTED" },
    });
  }

  private async persistSnapshot(snapshot: WhatsAppConnectionSnapshot): Promise<void> {
    try {
      const row = await this.ensureAccountRow();
      const data = {
        state: snapshot.state,
        phone: snapshot.phone,
        connectedAt: snapshot.connectedAt,
        lastDisconnectedAt: snapshot.state === "DISCONNECTED" ? new Date() : (row?.lastDisconnectedAt ?? null),
        lastError: snapshot.lastError,
      };
      if (row) {
        await this.prisma.whatsAppAccount.update({ where: { id: row.id }, data });
      }
    } catch (error) {
      console.error("[whatsapp] account state persist failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async persistSystemError(reason: string): Promise<void> {
    try {
      const row = await this.ensureAccountRow();
      if (row) {
        await this.prisma.whatsAppAccount.update({
          where: { id: row.id },
          data: { state: "ERROR", lastError: reason },
        });
      }
    } catch (error) {
      console.error("[whatsapp] lease-loss persist failed", {
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
}
