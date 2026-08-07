import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../security.service";
import { RoleCode, UserStatus } from "../../generated/prisma/enums";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import type { Prisma } from "../../generated/prisma/client";

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
  ) {}

  /** Регистрация покупателя/партнёра (BUYER по умолчанию, сам себя). */
  async register(input: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
  }): Promise<LoginResult> {
    if (input.password.length < 8) {
      throw new ValidationDomainError("Password must be at least 8 characters");
    }
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictError(`Username '${input.username}' already taken`);
    if (input.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (dup) throw new ConflictError("Email already registered");
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: RoleCode.BUYER } });
    const code = await this.ids.nextCode(this.prisma as unknown as Prisma.TransactionClient, "USR");
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        code,
        username: input.username,
        email: input.email ?? null,
        passwordHash,
        fullName: input.fullName ?? null,
        status: UserStatus.ACTIVE,
        roleId: role.id,
      },
      select: { id: true, code: true, username: true, email: true, fullName: true, status: true },
    });

    await this.security.audit(this.prisma as unknown as Prisma.TransactionClient, {
      userId: user.id,
      username: user.username,
      action: "auth.register",
      resource: "User",
      resourceId: user.id,
    });

    return this.login(user.username, input.password);
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

  /** Текущий пользователь + его актуальные права. */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException("User not found");
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
  }): Promise<LoginResult> {
    const payload = { sub: user.id, username: user.username, role: user.role.code };
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
