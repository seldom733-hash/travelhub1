import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  RequirePermissions,
} from "../../security/auth/decorators";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import type { AuthUser } from "../../security/auth/auth.service";
import {
  HOTEL_DIRECTORY_TYPES,
  HotelDirectoryService,
  type HotelDirectoryType,
} from "./hotel-directory.service";
import {
  CreateDirectoryEntryDto,
  UpdateDirectoryEntryDto,
} from "./hotel-directory.dto";

function parseType(type: string): HotelDirectoryType {
  if ((HOTEL_DIRECTORY_TYPES as readonly string[]).includes(type)) {
    return type as HotelDirectoryType;
  }
  throw new BadRequestException(
    `Unknown directory type '${type}'. Expected one of: ${HOTEL_DIRECTORY_TYPES.join(", ")}`,
  );
}

/**
 * Hotel reference directory admin API (Справочники → Отели).
 * One generic controller over categories / room-types / placement-types /
 * meal-types. Mutations are audited; reads/writes gated by
 * hotel_directory.* permissions.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("hotel-directory")
export class HotelDirectoryController {
  constructor(private readonly directory: HotelDirectoryService) {}

  @Get("search")
  @RequirePermissions("hotel_directory.read")
  search(
    @Query("q") q?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
  ) {
    return this.directory.search(q ?? "", type, status);
  }

  @Get(":type")
  @RequirePermissions("hotel_directory.read")
  list(@Param("type") type: string, @Query("status") status?: string) {
    return this.directory.list(parseType(type), status);
  }

  @Get(":type/:id")
  @RequirePermissions("hotel_directory.read")
  get(@Param("type") type: string, @Param("id") id: string) {
    return this.directory.get(parseType(type), id);
  }

  @Post(":type")
  @RequirePermissions("hotel_directory.create")
  create(
    @Param("type") type: string,
    @Body() dto: CreateDirectoryEntryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.directory.create(parseType(type), dto, actor);
  }

  @Patch(":type/:id")
  @RequirePermissions("hotel_directory.update")
  update(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() dto: UpdateDirectoryEntryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.directory.update(parseType(type), id, dto, actor);
  }

  @Delete(":type/:id")
  @RequirePermissions("hotel_directory.delete")
  remove(
    @Param("type") type: string,
    @Param("id") id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.directory.remove(parseType(type), id, actor);
  }
}
