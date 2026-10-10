import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { WhatsAppConfig } from "../whatsapp.config";
import { WHATSAPP_CONFIG } from "../whatsapp.tokens";
import {
  WHATSAPP_LEASE_KEY,
  WhatsAppLeaseError,
  WhatsAppSessionLeaseService,
  type LeaseHandle,
} from "../lease/session-lease.service";

/**
 * M2: SessionOwnershipService — heartbeat-владение арендой в рамках процесса
 * (решение владельца M2): periodic CAS-renewal, self-fencing при потере.
 *
 * Self-fencing: если продление не удалось (истёкло/перехвачено/токен устарел),
 * инстанс помечает себя НЕ владельцем, останавливает heartbeat и оповещает
 * слушателей (runtime гасит провайдера). Все операции, меняющие lifecycle/
 * auth/outbound state, обязаны пройти assertActive() → assertOwnership().
 *
 * M5 multi-number: инстанс создаётся РЕЕСТРОМ на каждый номер со своим
 * ключом аренды (`whatsapp:<accountId>`); дефолтный ключ — legacy singleton
 * (для одиночных юнит-тестов).
 */
@Injectable()
export class WhatsAppSessionOwnershipService implements OnApplicationShutdown {
  private handle: LeaseHandle | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lostFlag = false;
  private readonly lostListeners = new Set<(reason: string) => void>();

  constructor(
    private readonly lease: WhatsAppSessionLeaseService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    private readonly key: string = WHATSAPP_LEASE_KEY,
  ) {}

  /** Текущая аренда (null — не приобреталась/освобождена). */
  get current(): LeaseHandle | null {
    return this.handle;
  }

  /** Пометка «потеряли аренду» (self-fencing). */
  get isLost(): boolean {
    return this.lostFlag;
  }

  /** Есть ли активное владение (handle есть и не потерян). */
  get isActive(): boolean {
    return this.handle !== null && !this.lostFlag;
  }

  /**
   * Приобрести/подтвердить владение. Возвращает актуальный handle.
   * Если уже владеем и не потеряли — подтверждает свежесть через assertOwnership.
   */
  async ensureOwnership(): Promise<LeaseHandle> {
    if (this.handle && !this.lostFlag) {
      try {
        await this.lease.assertOwnership(this.key, this.handle);
        return this.handle;
      } catch {
        // Аренда перехвачена/истекла между heartbeat-ами → переприобретение.
        this.markLost("ownership assertion failed");
      }
    }
    const handle = await this.lease.acquire(this.key);
    this.handle = handle;
    this.lostFlag = false;
    this.startHeartbeat();
    return handle;
  }

  /**
   * Fencing-проверка перед изменением lifecycle/auth/outbound state.
   * Бросает WhatsAppLeaseError при отсутствии/потере владения; при живой
   * аренде дополнительно сверяет токен с БД (свежее чтение).
   */
  async assertActive(): Promise<LeaseHandle> {
    if (!this.handle || this.lostFlag) {
      throw new WhatsAppLeaseError(
        "lease_lost",
        "This instance does not own the WhatsApp session lease (self-fenced)",
      );
    }
    await this.lease.assertOwnership(this.key, this.handle);
    return this.handle;
  }

  /** Освободить аренду (graceful shutdown/disconnect). Идемпотентно. */
  async release(): Promise<void> {
    this.stopHeartbeat();
    const handle = this.handle;
    this.handle = null;
    this.lostFlag = false;
    if (handle) await this.lease.release(this.key, handle);
  }

  /** Подписка на потерю аренды (self-fencing event). */
  onLost(listener: (reason: string) => void): () => void {
    this.lostListeners.add(listener);
    return () => this.lostListeners.delete(listener);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.release();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.lease.heartbeatMs);
    this.timer.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Один heartbeat: CAS-продление; при неудаче — self-fencing. */
  private async tick(): Promise<void> {
    if (!this.handle || this.lostFlag) return;
    try {
      this.handle = await this.lease.renew(this.key, this.handle);
    } catch (error) {
      const reason =
        error instanceof WhatsAppLeaseError
          ? error.message
          : "heartbeat renewal failed with unexpected error";
      this.markLost(reason);
    }
  }

  private markLost(reason: string): void {
    this.stopHeartbeat();
    this.handle = null;
    if (this.lostFlag) return;
    this.lostFlag = true;
    for (const listener of [...this.lostListeners]) {
      try {
        listener(reason);
      } catch {
        // Слушатели не должны ломать self-fencing.
      }
    }
  }
}
