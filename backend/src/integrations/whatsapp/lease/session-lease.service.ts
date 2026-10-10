import { randomUUID } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { hostname } from "os";
import { PrismaService } from "../../../prisma/prisma.service";
import type { WhatsAppConfig } from "../whatsapp.config";
import { WHATSAPP_CONFIG } from "../whatsapp.tokens";
import { WhatsAppSessionError } from "../provider/whatsapp-errors";

/**
 * M2: WhatsAppSessionLease — single-owner аренда сессии (D2/I13, решение
 * владельца M2): instanceId, fencingToken, heartbeat, expiresAt, CAS-продление,
 * self-fencing. Строка аренды живёт в БД и переживает рестарты; fencingToken
 * МОНОТОННО растёт при каждой смене владельца и НИКОГДА не уменьшается
 * (release не удаляет строку).
 *
 * M5 multi-number: ключ аренды — per-account (`whatsapp:<accountId>`),
 * по одному ключу на номер. Старый singleton-ключ "whatsapp" не
 * используется: строка переносится на primary-номер в bootstrap реестра
 * (см. `migrateLegacyLeaseRow`), чтобы fencing-токен primary продолжал
 * монотонно расти и auth-state на диске не отвергал записи как зомби.
 *
 * CAS-семантика: все смены владельца/продления — updateMany с условием на
 * текущего владельца/токен; 0 затронутых строк = проигранная гонка/потеря
 * аренды (отказ, без «победы по времени»).
 */

/** Legacy singleton-ключ v1 (больше не используется; строка истекает сама). */
export const WHATSAPP_LEASE_KEY = "whatsapp";

/** M5: per-account ключ аренды (один номер = один lease-row). */
export function whatsappLeaseKey(accountId: string): string {
  return `whatsapp:${accountId}`;
}

export type WhatsAppLeaseErrorCode = "not_owner" | "lease_lost" | "contention";

/** Ошибка аренды (session-уровень, не retryable автоматически). */
export class WhatsAppLeaseError extends WhatsAppSessionError {
  readonly code: WhatsAppLeaseErrorCode;

  constructor(code: WhatsAppLeaseErrorCode, message: string) {
    super(message);
    this.name = "WhatsAppLeaseError";
    this.code = code;
  }
}

export interface LeaseHandle {
  readonly instanceId: string;
  readonly fencingToken: number;
  readonly expiresAt: Date;
}

export interface LeaseOwnerView {
  readonly instanceId: string;
  readonly fencingToken: number;
  readonly heartbeatAt: Date;
  readonly expiresAt: Date;
  readonly expired: boolean;
}

/** Узкий структурный контракт для prisma (unit-тесты подменяют фейком). */
export interface LeasePrismaLike {
  $transaction<T>(fn: (tx: LeasePrismaLike) => Promise<T>): Promise<T>;
  whatsAppSessionLease: {
    findUnique(args: { where: { key: string } }): Promise<LeaseRow | null>;
    create(args: { data: Record<string, unknown> }): Promise<LeaseRow>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
}

export interface LeaseRow {
  key: string;
  instanceId: string;
  fencingToken: number;
  heartbeatAt: Date;
  expiresAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class WhatsAppSessionLeaseService {
  /** Стабильный id этого процесса (для логов/отладки — не секрет). */
  readonly instanceId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  private readonly prisma: LeasePrismaLike;
  private readonly ttlMs: number;

  constructor(
    @Inject(PrismaService) prisma: PrismaService | LeasePrismaLike,
    @Inject(WHATSAPP_CONFIG) config: WhatsAppConfig,
  ) {
    this.prisma = prisma as LeasePrismaLike;
    this.ttlMs = config.lease.ttlMs;
  }

  /**
   * Перехват/продление аренды для ЭТОГО инстанса (ключ — per-account):
   *  - строки нет → create (токен 1);
   *  - свой tenant → CAS-продление (токен не меняется);
   *  - чужая, но истёкшая → CAS-перехват с fencingToken+1;
   *  - чужая живая → not_owner.
   */
  async acquire(key: string): Promise<LeaseHandle> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + this.ttlMs);
          const existing = await tx.whatsAppSessionLease.findUnique({
            where: { key },
          });
          if (!existing) {
            const row = await tx.whatsAppSessionLease.create({
              data: {
                key,
                instanceId: this.instanceId,
                fencingToken: 1,
                heartbeatAt: now,
                expiresAt,
              },
            });
            return { instanceId: row.instanceId, fencingToken: row.fencingToken, expiresAt: row.expiresAt };
          }
          if (existing.instanceId === this.instanceId) {
            const updated = await tx.whatsAppSessionLease.updateMany({
              where: { key, instanceId: this.instanceId, fencingToken: existing.fencingToken },
              data: { heartbeatAt: now, expiresAt },
            });
            if (updated.count === 0) throw new WhatsAppLeaseError("contention", "Lease renewal CAS lost");
            return { instanceId: this.instanceId, fencingToken: existing.fencingToken, expiresAt };
          }
          if (existing.expiresAt.getTime() <= now.getTime()) {
            // Перехват истёкшей аренды: токен растёт монотонно (fencing).
            const updated = await tx.whatsAppSessionLease.updateMany({
              where: {
                key,
                instanceId: existing.instanceId,
                fencingToken: existing.fencingToken,
              },
              data: {
                instanceId: this.instanceId,
                fencingToken: existing.fencingToken + 1,
                heartbeatAt: now,
                expiresAt,
              },
            });
            if (updated.count === 0) throw new WhatsAppLeaseError("contention", "Lease takeover CAS lost");
            return { instanceId: this.instanceId, fencingToken: existing.fencingToken + 1, expiresAt };
          }
          throw new WhatsAppLeaseError(
            "not_owner",
            `WhatsApp session lease is held by another instance until ${existing.expiresAt.toISOString()}`,
          );
        });
      } catch (error) {
        if (error instanceof WhatsAppLeaseError && error.code === "contention") {
          lastError = error;
          continue;
        }
        if (isUniqueViolation(error)) {
          // Гонка create-ов: другой инстанс создал строку первым → ретрай.
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new WhatsAppLeaseError("contention", "Lease acquire contention (3 attempts)");
  }

  /**
   * CAS-продление (heartbeat): только текущий владелец с актуальным токеном
   * и неистёкшей арендой. 0 строк = потеря аренды → self-fencing.
   */
  async renew(key: string, handle: LeaseHandle): Promise<LeaseHandle> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    const updated = await this.prisma.whatsAppSessionLease.updateMany({
      where: {
        key,
        instanceId: handle.instanceId,
        fencingToken: handle.fencingToken,
        expiresAt: { gt: now },
      },
      data: { heartbeatAt: now, expiresAt },
    });
    if (updated.count === 0) {
      throw new WhatsAppLeaseError(
        "lease_lost",
        "WhatsApp session lease renewal failed (expired, stolen or fencing token mismatch) — self-fencing",
      );
    }
    return { ...handle, expiresAt };
  }

  /**
   * Освобождение аренды (graceful shutdown/disconnect). Строка сохраняется
   * (токен монотонен), expiresAt переводится в прошлое → перехват возможен.
   */
  async release(key: string, handle: LeaseHandle): Promise<void> {
    const now = new Date();
    await this.prisma.whatsAppSessionLease.updateMany({
      where: { key, instanceId: handle.instanceId, fencingToken: handle.fencingToken },
      data: { heartbeatAt: now, expiresAt: now },
    });
  }

  /** Текущий владелец аренды (для status/диагностики). */
  async getOwner(key: string): Promise<LeaseOwnerView | null> {
    const row = await this.prisma.whatsAppSessionLease.findUnique({
      where: { key },
    });
    if (!row) return null;
    return {
      instanceId: row.instanceId,
      fencingToken: row.fencingToken,
      heartbeatAt: row.heartbeatAt,
      expiresAt: row.expiresAt,
      expired: row.expiresAt.getTime() <= Date.now(),
    };
  }

  /**
   * Fencing-проверка перед изменением lifecycle/auth/outbound state:
   * инстанс обязан быть владельцем со СВЕЖИМ (не истёкшим) токеном.
   */
  async assertOwnership(key: string, handle: LeaseHandle): Promise<void> {
    const row = await this.prisma.whatsAppSessionLease.findUnique({
      where: { key },
    });
    const now = Date.now();
    if (
      !row ||
      row.instanceId !== handle.instanceId ||
      row.fencingToken !== handle.fencingToken ||
      row.expiresAt.getTime() <= now
    ) {
      throw new WhatsAppLeaseError(
        "lease_lost",
        "Instance no longer owns the WhatsApp session lease (stale fencing token or expiry) — self-fencing",
      );
    }
  }
}
