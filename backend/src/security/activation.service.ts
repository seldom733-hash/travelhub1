import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityService } from "./security.service";
import { NotFoundError } from "../shared/errors";
import { UserStatus } from "../generated/prisma/enums";

/**
 * M4.3 §19 — activation token mechanics (owner decision: option B —
 * mechanics only, delivery deferred; no fake SMS/email, no plaintext storage,
 * no operator-set passwords).
 *
 * Contract:
 *  - issue:  random 256-bit token (base64url) возвращается plaintext ОДИН раз
 *    в ответе; в БД — только SHA-256 hash; ttl = ACTIVATION_TOKEN_TTL_MS.
 *  - consume: single-use (CAS по usedAt IS NULL) + expiry; все отказы —
 *    одинаковый 401 (без enumeration); активация = INACTIVE/LOCKED → ACTIVE,
 *    tokenVersion++ (старые сессии не воскресают — session behavior §26).
 *  - секреты никогда не логируются (§19/§33); аудит — только метаданные.
 *
 * Delivery dependency (точно, до которой отложено): провайдер доставки
 * activation-ссылки (email/SMS/WhatsApp) отсутствует — см.
 * M4-IMPLEMENTATION-REPORT §Activation. До его появления выданную ссылку
 * может передать оператор вручную (админ-issue endpoint).
 */
const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

export interface ActivationIssueResult {
  /** Plaintext — возвращается ТОЛЬКО здесь, в БД не хранится и не логируется. */
  token: string;
  expiresAt: Date;
}

@Injectable()
export class ActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  private hash(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  /** Issue activation token для user. actor = инициатор (admin) или null (system). */
  async issue(userId: string, actor: { id: string; username: string } | null): Promise<ActivationIssueResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) throw new NotFoundError(`User ${userId} not found`);

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
    await this.prisma.activationToken.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        expiresAt,
        issuedBy: actor?.id ?? null,
      },
    });

    // Аудит без plaintext-секрета (§19/§33): только метаданные.
    await this.security.audit(undefined, {
      userId: actor?.id ?? null,
      username: actor?.username ?? "system",
      action: "account.activation_issued",
      resource: "ActivationToken",
      resourceId: userId,
      details: { targetUserId: userId, expiresAt: expiresAt.toISOString() },
    });

    return { token, expiresAt };
  }

  /** Потребить token: single-use + expiry; активирует User (→ ACTIVE). */
  async consume(token: string): Promise<{ ok: true; userId: string }> {
    const tokenHash = this.hash(token);
    const now = new Date();

    // CAS single-use: только если не использован и не истёк. Гонка двух
    // consume → ровно один winner (count === 1), проигравший — 401.
    const claimed = await this.prisma.activationToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      // Неотличимо: неизвестный / истёкший / уже использованный (без enumeration).
      throw new UnauthorizedException("Invalid or expired activation token");
    }

    const row = await this.prisma.activationToken.findUnique({ where: { tokenHash } });
    if (!row) throw new UnauthorizedException("Invalid or expired activation token");
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, username: true, status: true },
    });
    if (!user) throw new UnauthorizedException("Invalid or expired activation token");

    // Активация + session behavior: tokenVersion++ — все ранее выданные JWT
    // (в т.ч. выданные до деактивации) немедленно недействительны; свежий
    // login обязателен. Вся пара (user.update + audit) — одна транзакция.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE, tokenVersion: { increment: 1 } },
      });
      await this.security.audit(tx, {
        userId: user.id,
        username: user.username,
        action: "account.activation",
        resource: "User",
        resourceId: user.id,
        details: { statusBefore: user.status },
      });
    });

    return { ok: true, userId: user.id };
  }
}
