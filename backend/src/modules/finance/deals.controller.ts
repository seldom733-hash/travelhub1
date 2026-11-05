import { Body, Controller, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import ExcelJS from "exceljs";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { DealsService } from "./deals.service";

function queryFrom(raw: Record<string, string | undefined>) {
  return {
    search: raw.search,
    stage: raw.stage,
    scope: raw.scope,
    state: raw.state,
    status: raw.status,
    statusGroup: raw.statusGroup,
    cancellationReason: raw.cancellationReason,
    supplierId: raw.supplierId,
    country: raw.country,
    manager: raw.manager,
    clientPayment: raw.clientPayment,
    supplierPayment: raw.supplierPayment,
    financialStatus: raw.financialStatus,
    serviceType: raw.serviceType,
    dateFrom: raw.dateFrom,
    dateTo: raw.dateTo,
    dateField: (raw.dateField as "createdAt" | "serviceDate" | "financial" | undefined) ?? "createdAt",
    page: raw.page ? Number(raw.page) : 1,
    pageSize: raw.pageSize ? Number(raw.pageSize) : 20,
    sortBy: raw.sortBy,
    sortDirection: raw.sortDirection === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

@Controller("finance/deals")
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  @RequirePermissions("finance.overview.read")
  list(@Query() query: Record<string, string | undefined>, @CurrentUser() user: AuthedRequest["user"]) {
    return this.deals.list({ ...queryFrom(query), viewerId: user.id });
  }

  @Get(":sequence/history")
  @RequirePermissions("finance.overview.read")
  history(@Param("sequence") sequence: string) {
    return this.deals.history(sequence);
  }

  @Get("summary")
  @RequirePermissions("finance.overview.read")
  summary(@Query() query: Record<string, string | undefined>) {
    return this.deals.summary(queryFrom(query));
  }

  @Get("export")
  @RequirePermissions("finance.overview.read")
  async export(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const rows = await this.deals.exportRows(queryFrom({ ...query, pageSize: "100" }));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Deals");
    sheet.addRow(["Общий №", "REQ", "ORD", "BKG", "Стадия", "Клиент", "Услуга", "Тип", "Поставщик", "Туристы", "Сумма продажи", "Себестоимость", "Получено", "Долг клиента", "Возвращено", "Оплачено поставщику", "Долг поставщику", "Возврат поставщика", "Штраф клиента", "Штраф поставщика", "Ожидаемый доход", "Текущий доход", "Валюта"]);
    for (const row of rows) {
      sheet.addRow([row.sequence, row.requestCode, row.orderCode ?? "—", row.bookingCode ?? "—", row.stageLabel, row.customerName, row.productTitle, row.productType, row.supplierCode ?? "—", row.travelerCount ?? "—", row.salesAmount, row.costAmount, row.clientReceived, row.clientDebt, row.clientRefunded, row.supplierPaid, row.supplierDebt, row.supplierRefunded, row.clientPenalty, row.supplierPenalty, row.expectedIncome, row.currentIncome, row.currency]);
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="deals.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get(":sequence/schedule")
  @RequirePermissions("finance.overview.read")
  schedule(@Param("sequence") sequence: string) {
    return this.deals.paymentSchedule(sequence);
  }

  @Post(":sequence/schedule")
  @RequirePermissions("finance.settlement.manage")
  createSchedule(@Param("sequence") sequence: string, @Body() body: { stage?: string; dueDate?: string; amount?: number | string; percent?: number; condition?: string; note?: string }) {
    return this.deals.createSchedule(sequence, body);
  }

  @Patch(":sequence/schedule/:id")
  @RequirePermissions("finance.settlement.manage")
  updateSchedule(@Param("sequence") sequence: string, @Param("id") id: string, @Body() body: { status?: string; amount?: number | string; condition?: string }) {
    return this.deals.updateSchedule(sequence, id, body);
  }

  @Get(":sequence")
  @RequirePermissions("finance.overview.read")
  one(@Param("sequence") sequence: string) {
    return this.deals.bySequence(sequence);
  }
}
