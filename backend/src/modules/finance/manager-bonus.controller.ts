import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../security/auth/decorators";
import { ManagerBonusService } from "./manager-bonus.service";

@Controller("finance/manager-bonuses")
export class ManagerBonusController {
  constructor(private readonly bonuses: ManagerBonusService) {}

  @Get()
  @RequirePermissions("finance.bonus.read")
  list(@Query("periods") periods?: string, @Query("basis") basis?: string, @Query("period") period?: string) {
    return this.bonuses.list(periods, basis, period);
  }

  @Post()
  @RequirePermissions("finance.deal.amounts.write")
  save(@Body() body: { managerId?: string; period?: string; periods?: string[] | string; percent?: number | string; basis?: string }) {
    return this.bonuses.save(body);
  }
}
