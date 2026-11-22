import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../security/auth/decorators";
import { ManagerBonusService } from "./manager-bonus.service";

@Controller("finance/manager-bonuses")
export class ManagerBonusController {
  constructor(private readonly bonuses: ManagerBonusService) {}

  @Get()
  @RequirePermissions("finance.overview.read")
  list(@Query("period") period?: string, @Query("basis") basis?: string) {
    return this.bonuses.list(period, basis);
  }

  @Post()
  @RequirePermissions("finance.deal.amounts.write")
  save(@Body() body: { managerId?: string; period?: string; percent?: number | string; basis?: string }) {
    return this.bonuses.save(body);
  }
}
