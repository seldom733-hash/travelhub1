import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../security.service";
import { CrmService } from "../../modules/crm/crm.service";
import { PartnerOnboardingService } from "../partner/partner-onboarding.service";
import { ApplicantType, RoleCode, UserStatus } from "../../generated/prisma/enums";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import { normalizeEmail } from "../../shared/field-validation";
import type { Prisma } from "../../generated/prisma/client";
import type { Request } from "express";

export interface AuthUser {
  id: string;
  code: string;
  username: string;
  email: string | null;
  fullName: string | null;
  status: UserStatus;
  role: RoleCode;
  roleTitle: string;
  partnerId: string | null;
  customerId: string | null;
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

/**
 * AuthModule (Phase 2): регистрация/вход по паролю (bcrypt), JWT-токены,
 * /auth/me со свежими правами роли (права читаются из БД, а не из токена —
 * смена роли применяется немедленно).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly jwt: JwtService,
    private readonly crm: CrmService,
    private readonly onboarding: PartnerOnboardingService,
  ) {}

  /**
   * Регистрация BUYER (сам себя, роль всегда BUYER — клиент не может передать role).
   *
   * Step 1.9 (Clarification): синхронная application orchestration в ОДНОЙ
   * транзакции (обе схемы в одной PostgreSQL БД):
   *   create security.User (ACTIVE, BUYER)
   *   → CrmService.ensureCustomerForBuyer (CRM-owned create-or-link по email)
   *   → link User.customerId
   *   → audit
   * Провал CRM-шага откатывает ВСЁ (нет ACTIVE BUYER с customerId=null).
   * Retry идемпотентен: Customer.email @unique + reuse → дубликат невозможен.
   */
  async register(input: {
    username?: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  }): Promise<LoginResult> {
    if (input.password.length < 8) {
      throw new ValidationDomainError("Password must be at least 8 characters");
    }
    const email = normalizeEmail(input.email);
    // Identity: username по умолчанию = email (публичная self-registration не
    // собирает отдельный логин).
    const username = (input.username ?? email).trim();
    if (username.length < 3) {
      throw new ValidationDomainError("Username must be at least 3 characters");
    }

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new ConflictError(`Username '${username}' already taken`);
    const emailDup = await this.prisma.user.findUnique({ where: { email } });
    if (emailDup) throw new ConflictError("Email already registered");

    const fullName = input.fullName ?? ((`${input.firstName ?? ""} ${input.lastName ?? ""}`.trim()) || null);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: RoleCode.BUYER } });
    const passwordHash = await bcrypt.hash(input.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "USR");
      const user = await tx.user.create({
        data: {
          code,
          username,
          email,
          passwordHash,
          fullName,
          status: UserStatus.ACTIVE,
          roleId: role.id,
        },
        select: { id: true, code: true, username: true, email: true, fullName: true, status: true },
      });

      // CRM-owned command: create-or-link Customer (в транзакции регистрации).
      const { customerId } = await this.crm.ensureCustomerForBuyer(tx, {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        actorUserId: user.id,
      });

      // Invariant: ACTIVE BUYER ⇒ valid User.customerId ⇒ existing CRM Customer.
      await tx.user.update({ where: { id: user.id }, data: { customerId } });

      await this.security.audit(tx, {
        userId: user.id,
        username: user.username,
        action: "auth.register",
        resource: "User",
        resourceId: user.id,
        details: { customerId },
      });

      return user;
    });

    return this.login(created.username, input.password);
  }

  /**
   * Step 1.10 — публичная регистрация PARTNER (onboarding, НЕ activation).
   *
   * Регистрация ≠ Partner approval ≠ Product moderation ≠ Payment/KYC.
   * Создаётся User (role PARTNER, ACTIVE) + PartnerApplication (DRAFT) в ОДНОЙ
   * транзакции. Selling-доступ НЕ выдаётся: partnerId=null до approve, и все
   * selling gates (Product create/list) проверяют его. Self-registration не может
   * передать роль/partnerId/статус (forbidden-keys + DTO whitelist).
   */
  async registerPartner(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    applicantType: ApplicantType;
    brandName: string;
    country: string;
    legalName?: string;
    registrationNumber?: string;
    taxId?: string;
    website?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    businessDescription?: string;
    serviceCategories?: string[];
    termsAccepted: boolean;
  }): Promise<LoginResult> {
    if (input.password.length < 8) {
      throw new ValidationDomainError("Password must be at least 8 characters");
    }
    if (input.termsAccepted !== true) {
      throw new ValidationDomainError("Terms and conditions must be accepted");
    }
    const email = normalizeEmail(input.email);
    const username = email; // публичная self-registration: логин = email
    if (username.length < 3) {
      throw new ValidationDomainError("Username must be at least 3 characters");
    }
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new ConflictError(`Username '${username}' already taken`);
    const emailDup = await this.prisma.user.findUnique({ where: { email } });
    if (emailDup) throw new ConflictError("Email already registered");

    const fullName = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || null;
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: RoleCode.PARTNER } });
    const passwordHash = await bcrypt.hash(input.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "USR");
      const user = await tx.user.create({
        data: {
          code,
          username,
          email,
          passwordHash,
          fullName,
          status: UserStatus.ACTIVE,
          roleId: role.id,
        },
        select: { id: true, code: true, username: true, email: true, fullName: true, status: true },
      });

      // Onboarding application (DRAFT) — security-owned, same tx.
      const app = await this.onboarding.createApplication(tx, user.id, {
        applicantType: input.applicantType,
        brandName: input.brandName,
        country: input.country,
        legalName: input.legalName,
        registrationNumber: input.registrationNumber,
        taxId: input.taxId,
        website: input.website,
        contactEmail: input.contactEmail ?? email,
        contactPhone: input.contactPhone,
        address: input.address,
        businessDescription: input.businessDescription,
        serviceCategories: input.serviceCategories,
        termsAccepted: true,
      });

      await this.security.audit(tx, {
        userId: user.id,
        username: user.username,
        action: "auth.partner_register",
        resource: "User",
        resourceId: user.id,
        details: { applicationId: app.id },
      });
      await this.security.audit(tx, {
        userId: user.id,
        username: user.username,
        action: "partner_application.created",
        resource: "PartnerApplication",
        resourceId: app.id,
        details: { status: "DRAFT" },
      });

      return user;
    });

    return this.login(created.username, input.password);
  }

  /** Вход: проверка пароля, выдача JWT. */
  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid username or password");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is not active");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.security.audit(this.prisma as unknown as Prisma.TransactionClient, {
      userId: user.id,
      username: user.username,
      action: "auth.login",
      resource: "User",
      resourceId: user.id,
    });

    return this.buildSession(user);
  }

  /**
   * Step 2.17 — реальная revocation: инкремент tokenVersion инвалидирует ВСЕ
   * ранее выданные JWT (payload.tv !== tokenVersion → 401 в me()). Вызывается
   * при logout. Идемпотентна: повторный вызов — ещё один инкремент, безопасен.
   */
  async revokeSession(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  /**
   * Текущий пользователь + его актуальные права.
   * Step 1.9 §12: НЕ-ACTIVE пользователь (INACTIVE/LOCKED) не сохраняет
   * действующий доступ — любой защищённый запрос с его токеном отклоняется
   * (guard вызывает me() на каждый запрос).
   */
  /**
   * Step 2.17 — сессионная проба для cookie-аутентификации (GET /auth/session).
   * Токен из Authorization: Bearer ИЛИ HttpOnly cookie travelhub.auth; проверка
   * tv (revocation) и ACTIVE. Любая ошибка → null (public, без исключений).
   */
  async sessionUser(req: Request): Promise<AuthUser | null> {
    let token: string | undefined;
    const [type, headerToken] = req.headers.authorization?.split(" ") ?? [];
    if (type === "Bearer" && headerToken) {
      token = headerToken;
    } else {
      const cookie = (req.headers.cookie ?? "")
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("travelhub.auth="))
        ?.slice("travelhub.auth=".length);
      token = cookie ? decodeURIComponent(cookie) : undefined;
    }
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; tv?: number }>(token);
      if (!payload.sub) return null;
      return await this.me(payload.sub, payload.tv);
    } catch {
      return null; // невалидный/истёкший/revoked/INACTIVE → null, не 401
    }
  }

  async me(userId: string, tokenVersion?: number): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException("User not found");
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is not active");
    }
    // Step 2.17: tokenVersion revocation. Токен, выданный до logout/revoke,
    // имеет старое tv — отклоняется, даже если JWT ещё не истёк.
    if (tokenVersion !== undefined && user.tokenVersion !== tokenVersion) {
      throw new UnauthorizedException("Session has been revoked");
    }
    return this.toAuthUser(user);
  }

  /** Выдача JWT (статистически бессрочный refresh не вводим — Phase 2 короткий). */
  private async buildSession(user: {
    id: string;
    code: string;
    username: string;
    email: string | null;
    fullName: string | null;
    status: UserStatus;
    role: { code: RoleCode; title: string };
    partnerId: string | null;
    customerId: string | null;
    tokenVersion: number;
  }): Promise<LoginResult> {
    // Step 2.17: tv (tokenVersion) в JWT — logout/revoke инвалидирует сессии.
    const payload = { sub: user.id, username: user.username, role: user.role.code, tv: user.tokenVersion };
    const accessToken = await this.jwt.signAsync(payload);
    const authUser = await this.toAuthUser(user);
    return { accessToken, user: authUser };
  }

  private async toAuthUser(user: {
    id: string;
    code: string;
    username: string;
    email: string | null;
    fullName: string | null;
    status: UserStatus;
    role: { code: RoleCode; title: string };
    partnerId: string | null;
    customerId: string | null;
  }): Promise<AuthUser> {
    const permissions = await this.security.permissionsOf(user.id);
    return {
      id: user.id,
      code: user.code,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      role: user.role.code,
      roleTitle: user.role.title,
      partnerId: user.partnerId,
      customerId: user.customerId,
      permissions,
    };
  }
}
