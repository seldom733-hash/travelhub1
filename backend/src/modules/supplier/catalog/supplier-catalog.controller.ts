import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";
import { SupplierCatalogService } from "./supplier-catalog.service";

class StartPreviewDto {
  @IsString()
  @MaxLength(40)
  supplierCode!: string;

  @IsIn(["tours", "hotels", "all"])
  serviceType!: "tours" | "hotels" | "all";

  @IsString()
  @MaxLength(120)
  countryKey!: string;
}

class DiscoverCountriesDto {
  @IsString()
  @MaxLength(40)
  supplierCode!: string;

  @IsIn(["tours", "hotels"])
  serviceType!: "tours" | "hotels";
}

/**
 * Admin-only catalog refresh. Preview creates only SupplierCatalogRun/Item
 * rows; Product/Tariff changes happen only after explicit confirm.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("supplier/catalog")
export class SupplierCatalogController {
  constructor(private readonly service: SupplierCatalogService) {}

  @Get("capabilities")
  @RequirePermissions("supplier.search.read")
  capabilities() {
    return this.service.activeCapabilities();
  }

  @Post("countries/discover")
  @RequirePermissions("supplier.search.manage")
  discoverCountries(@Body() body: DiscoverCountriesDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.service.discoverCountries(actor, body);
  }

  @Get("runs")
  @RequirePermissions("supplier.search.read")
  listRuns(@Query("limit") limit?: string) {
    return this.service.listRuns(limit ? Number(limit) : 30);
  }

  @Get("runs/:id")
  @RequirePermissions("supplier.search.read")
  getRun(@Param("id") id: string) {
    return this.service.getRun(id);
  }

  @Post("runs/preview")
  @RequirePermissions("supplier.search.manage")
  preview(@Body() body: StartPreviewDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.service.startPreview(actor, body);
  }

  @Post("runs/:id/confirm")
  @RequirePermissions("supplier.search.manage")
  confirm(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.service.confirm(actor, id);
  }

  @Post("runs/:id/cancel")
  @RequirePermissions("supplier.search.manage")
  cancel(@Param("id") id: string) {
    return this.service.cancel(id);
  }

  @Post("runs/:id/items/:itemId/restore")
  @RequirePermissions("supplier.search.manage")
  manualRestore(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.service.manualRestore(actor, id, itemId);
  }
}
