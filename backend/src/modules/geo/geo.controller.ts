import {
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
import { GeoService } from "./geo.service";
import {
  CreateAirportDto,
  CreateCityDto,
  CreateCountryDto,
  CreateResortDto,
  UpdateAirportDto,
  UpdateCityDto,
  UpdateCountryDto,
  UpdateResortDto,
} from "./geo.dto";

/**
 * Master Geography admin API (geo.*).
 *
 * Read/write guarded by geography.* permissions. Every mutation is
 * written to security.AuditLog. User-facing search availability is NOT
 * decided here — see GeographyAvailabilityService (Phase 4).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("geo")
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get("search")
  @RequirePermissions("geography.read")
  search(
    @Query("q") q?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
  ) {
    return this.geo.search(q ?? "", type, status);
  }

  // ── Countries ─────────────────────────────────────────────────

  @Get("countries")
  @RequirePermissions("geography.read")
  listCountries(@Query("status") status?: string) {
    return this.geo.listCountries(status);
  }

  @Get("countries/:id")
  @RequirePermissions("geography.read")
  getCountry(@Param("id") id: string) {
    return this.geo.getCountry(id);
  }

  @Post("countries")
  @RequirePermissions("geography.create")
  createCountry(
    @Body() dto: CreateCountryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.geo.createCountry(dto, actor);
  }

  @Patch("countries/:id")
  @RequirePermissions("geography.update")
  updateCountry(
    @Param("id") id: string,
    @Body() dto: UpdateCountryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.geo.updateCountry(id, dto, actor);
  }

  @Delete("countries/:id")
  @RequirePermissions("geography.delete")
  deleteCountry(@Param("id") id: string, @CurrentUser() actor: AuthUser) {
    return this.geo.deleteCountry(id, actor);
  }

  // ── Cities ────────────────────────────────────────────────────

  @Get("cities")
  @RequirePermissions("geography.read")
  listCities(
    @Query("countryId") countryId?: string,
    @Query("status") status?: string,
  ) {
    return this.geo.listCities(countryId, status);
  }

  @Get("cities/:id")
  @RequirePermissions("geography.read")
  getCity(@Param("id") id: string) {
    return this.geo.getCity(id);
  }

  @Post("cities")
  @RequirePermissions("geography.create")
  createCity(@Body() dto: CreateCityDto, @CurrentUser() actor: AuthUser) {
    return this.geo.createCity(dto, actor);
  }

  @Patch("cities/:id")
  @RequirePermissions("geography.update")
  updateCity(
    @Param("id") id: string,
    @Body() dto: UpdateCityDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.geo.updateCity(id, dto, actor);
  }

  @Delete("cities/:id")
  @RequirePermissions("geography.delete")
  deleteCity(@Param("id") id: string, @CurrentUser() actor: AuthUser) {
    return this.geo.deleteCity(id, actor);
  }

  // ── Resorts ───────────────────────────────────────────────────

  @Get("resorts")
  @RequirePermissions("geography.read")
  listResorts(
    @Query("cityId") cityId?: string,
    @Query("status") status?: string,
  ) {
    return this.geo.listResorts(cityId, status);
  }

  @Get("resorts/:id")
  @RequirePermissions("geography.read")
  getResort(@Param("id") id: string) {
    return this.geo.getResort(id);
  }

  @Post("resorts")
  @RequirePermissions("geography.create")
  createResort(@Body() dto: CreateResortDto, @CurrentUser() actor: AuthUser) {
    return this.geo.createResort(dto, actor);
  }

  @Patch("resorts/:id")
  @RequirePermissions("geography.update")
  updateResort(
    @Param("id") id: string,
    @Body() dto: UpdateResortDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.geo.updateResort(id, dto, actor);
  }

  @Delete("resorts/:id")
  @RequirePermissions("geography.delete")
  deleteResort(@Param("id") id: string, @CurrentUser() actor: AuthUser) {
    return this.geo.deleteResort(id, actor);
  }

  // ── Airports ──────────────────────────────────────────────────

  @Get("airports")
  @RequirePermissions("geography.read")
  listAirports(
    @Query("cityId") cityId?: string,
    @Query("status") status?: string,
  ) {
    return this.geo.listAirports(cityId, status);
  }

  @Get("airports/:id")
  @RequirePermissions("geography.read")
  getAirport(@Param("id") id: string) {
    return this.geo.getAirport(id);
  }

  @Post("airports")
  @RequirePermissions("geography.create")
  createAirport(@Body() dto: CreateAirportDto, @CurrentUser() actor: AuthUser) {
    return this.geo.createAirport(dto, actor);
  }

  @Patch("airports/:id")
  @RequirePermissions("geography.update")
  updateAirport(
    @Param("id") id: string,
    @Body() dto: UpdateAirportDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.geo.updateAirport(id, dto, actor);
  }

  @Delete("airports/:id")
  @RequirePermissions("geography.delete")
  deleteAirport(@Param("id") id: string, @CurrentUser() actor: AuthUser) {
    return this.geo.deleteAirport(id, actor);
  }
}
