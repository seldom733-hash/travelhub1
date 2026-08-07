import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { RoleCode, UserStatus } from "../generated/prisma/enums";
import { SecurityService } from "./security.service";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "./auth/decorators";
import type { AuthedRequest } from "./auth/jwt-auth.guard";

class ListUsersQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;
}

class CreateStaffDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsEnum(RoleCode)
  roleCode!: RoleCode;
}

class AssignRoleDto {
  @IsEnum(RoleCode)
  roleCode!: RoleCode;
}

class SetStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

/**
 * REST API: /api/v1/users → управление пользователями (ADMIN, settings.write).
 * Канонические роли — только из RBAC Matrix; новых ролей без ADR не создаём.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  @RequirePermissions("settings.write")
  listUsers(@Query() query: ListUsersQuery) {
    return this.security.listUsers(query);
  }

  @Post()
  @RequirePermissions("settings.write")
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.security.createStaff({ ...dto, partnerId: undefined, customerId: undefined });
  }

  @Patch(":id/role")
  @RequirePermissions("settings.write")
  assignRole(@Param("id") id: string, @Body() dto: AssignRoleDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.security.assignRole(id, dto.roleCode, actor.id);
  }

  @Patch(":id/status")
  @RequirePermissions("settings.write")
  setStatus(@Param("id") id: string, @Body() dto: SetStatusDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.security.setStatus(id, dto.status, actor.id);
  }
}
