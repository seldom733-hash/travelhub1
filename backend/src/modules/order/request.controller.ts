import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { RequestService } from "./request.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser } from "../../security/auth/decorators";
import { ExportService } from "../shared/export/export.service";

@Controller("requests")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequestController {
  constructor(
    private readonly requestService: RequestService,
    private readonly exportService: ExportService,
  ) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("customerId") customerId?: string,
    @Query("partnerId") partnerId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.requestService.listRequests({
      status,
      customerId,
      partnerId,
      search,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      dateFrom,
      dateTo,
    });
  }

  @Get("kpi")
  kpi() {
    return this.requestService.getRequestKpi();
  }

  @Get("export")
  async export(
    @Res() res: Response,
    @Query("format") format: string,
    @Query("status") status?: string,
    @Query("customerId") customerId?: string,
    @Query("partnerId") partnerId?: string,
    @Query("search") search?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    const result = await this.requestService.listRequests({
      status,
      customerId,
      partnerId,
      search,
      dateFrom,
      dateTo,
      page: 1,
      pageSize: 10000,
    });

    const rows = result.data.map((r: any) => ({
      referenceNumber: r.referenceNumber,
      commerceSequence: r.commerceSequence,
      status: r.status,
      customerId: r.customerId ?? "",
      productId: r.productId ?? "",
      partnerId: r.partnerId ?? "",
      displayedPrice: r.displayedPrice ?? "",
      displayedCurrency: r.displayedCurrency ?? "",
      confirmedPrice: r.confirmedPrice ?? "",
      confirmedCurrency: r.confirmedCurrency ?? "",
      requestedServiceDate: r.requestedServiceDate ?? "",
      quantity: r.quantity,
      supplierResponseDeadline: r.supplierResponseDeadline ?? "",
      supplierRespondedAt: r.supplierRespondedAt ?? "",
      supplierDecision: r.supplierDecision ?? "",
      customerActionDeadline: r.customerActionDeadline ?? "",
      customerDecision: r.customerDecision ?? "",
      convertedOrderId: r.convertedOrderId ?? "",
      createdAt: r.createdAt ?? "",
    }));

    const headers = [
      { header: "№ Заявки", key: "referenceNumber", width: 24 },
      { header: "Commerce Seq", key: "commerceSequence", width: 14 },
      { header: "Статус", key: "status", width: 22 },
      { header: "Клиент", key: "customerId", width: 22 },
      { header: "Услуга", key: "productId", width: 22 },
      { header: "Поставщик", key: "partnerId", width: 22 },
      { header: "Цена витрины", key: "displayedPrice", width: 15 },
      { header: "Валюта", key: "displayedCurrency", width: 8 },
      { header: "Подтв. цена", key: "confirmedPrice", width: 15 },
      { header: "Подтв. валюта", key: "confirmedCurrency", width: 8 },
      { header: "Дата услуги", key: "requestedServiceDate", width: 14 },
      { header: "Кол-во", key: "quantity", width: 8 },
      { header: "SLA дедлайн", key: "supplierResponseDeadline", width: 22 },
      { header: "Поставщик ответил", key: "supplierRespondedAt", width: 22 },
      { header: "Решение поставщика", key: "supplierDecision", width: 18 },
      { header: "Дедлайн клиента", key: "customerActionDeadline", width: 22 },
      { header: "Решение клиента", key: "customerDecision", width: 16 },
      { header: "Заказ", key: "convertedOrderId", width: 22 },
      { header: "Создана", key: "createdAt", width: 22 },
    ];

    if (format === "xlsx") {
      const buffer = await this.exportService.toXlsx(headers, rows, "Заявки");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=requests.xlsx");
      res.send(buffer);
    } else {
      const csv = this.exportService.toCsv(headers, rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=requests.csv");
      res.send(csv);
    }
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.requestService.getRequest(id);
  }

  @Get(":id/history")
  history(@Param("id") id: string) {
    return this.requestService.getRequestHistory(id);
  }

  @Post()
  create(
    @CurrentUser() user: any,
    @Body() body: {
      customerId?: string;
      productId?: string;
      partnerId?: string;
      requestedServiceDate?: string;
      quantity?: number;
      displayedPrice?: number;
      displayedCurrency?: string;
    },
  ) {
    return this.requestService.createRequest(body, { id: user.id, username: user.username });
  }

  @Post(":id/confirm-price")
  confirmPrice(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { note?: string },
  ) {
    return this.requestService.confirmPrice(id, { id: user.id, username: user.username }, body.note);
  }

  @Post(":id/propose-price")
  proposePrice(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { price: number; note?: string },
  ) {
    return this.requestService.proposePrice(id, { id: user.id, username: user.username }, body.price, body.note);
  }

  @Post(":id/reject")
  reject(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return this.requestService.rejectRequest(id, { id: user.id, username: user.username }, body.reason);
  }

  @Post(":id/unavailable")
  unavailable(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return this.requestService.markUnavailable(id, { id: user.id, username: user.username }, body.reason);
  }

  @Post(":id/customer-accept")
  customerAccept(
    @CurrentUser() user: any,
    @Param("id") id: string,
  ) {
    return this.requestService.customerAccept(id, { id: user.id, username: user.username });
  }

  @Post(":id/customer-decline")
  customerDecline(
    @CurrentUser() user: any,
    @Param("id") id: string,
  ) {
    return this.requestService.customerDecline(id, { id: user.id, username: user.username });
  }
}
