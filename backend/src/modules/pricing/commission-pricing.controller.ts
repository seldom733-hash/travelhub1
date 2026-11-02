import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import { SupplierCommissionService } from "./supplier-commission.service";
import { MarkupMatrixService } from "./markup-matrix.service";
import { calculateSupplierPricing } from "./commission-calculator";

@Controller("pricing")
export class CommissionPricingController {
  constructor(
    private readonly commissions: SupplierCommissionService,
    private readonly matrix: MarkupMatrixService,
  ) {}

  @Get("commission-matrix")
  @RequirePermissions("pricing.markup.read")
  commissionMatrix() {
    return this.matrix.buildCommission();
  }

  @Get("commission-rules")
  @RequirePermissions("pricing.markup.read")
  list(@Query() query: Record<string, string | undefined>) {
    return this.commissions.list({ supplierCode: query.supplierCode, serviceType: query.serviceType, status: query.status, page: query.page ? Number(query.page) : 1, pageSize: query.pageSize ? Number(query.pageSize) : 20 });
  }

  @Get("commission-rules/:code/history")
  @RequirePermissions("pricing.markup.read")
  history(@Param("code") code: string) {
    return this.commissions.history(code);
  }

  @Post("commission-rules")
  @RequirePermissions("pricing.markup.manage")
  create(@Body() body: Record<string, string | undefined>, @CurrentUser() user: { id: string; username: string }) {
    return this.commissions.create(body as never, user);
  }

  @Patch("commission-rules/:code")
  @RequirePermissions("pricing.markup.manage")
  update(@Param("code") code: string, @Body() body: Record<string, string | number | undefined>, @CurrentUser() user: { id: string; username: string }) {
    return this.commissions.update(code, body as never, user);
  }

  @Post("commission-rules/:code/activate")
  @RequirePermissions("pricing.markup.manage")
  activate(@Param("code") code: string, @CurrentUser() user: { id: string; username: string }) {
    return this.commissions.activate(code, user);
  }

  @Post("commission-rules/:code/archive")
  @RequirePermissions("pricing.markup.manage")
  archive(@Param("code") code: string, @CurrentUser() user: { id: string; username: string }) {
    return this.commissions.archive(code, user);
  }

  @Post("calculate")
  @RequirePermissions("pricing.markup.read")
  calculate(@Body() body: {
    supplierBasePrice: string;
    currency: string;
    markupRate?: string;
    commissionType?: "PERCENT" | "FIXED" | "NONE";
    commissionRate?: string;
    commissionFixedAmount?: string;
    commissionBase?: "SUPPLIER_BASE" | "STOREFRONT";
  }) {
    return calculateSupplierPricing({
      supplierBasePrice: body.supplierBasePrice,
      currency: body.currency,
      markupRate: body.markupRate ?? "0",
      commissionType: body.commissionType,
      commissionRate: body.commissionRate,
      commissionFixedAmount: body.commissionFixedAmount,
      commissionBase: body.commissionBase,
    });
  }
}
