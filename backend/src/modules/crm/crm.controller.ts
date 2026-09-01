import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from 'express';
import { ExportService } from '../shared/export/export.service';
import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CustomerType, EntityStatus } from "../../generated/prisma/enums";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { VALID_LEAD_SOURCES } from "./crm-lead-source.constants";

/** Validate leadSource against canonical values. Null/undefined = allowed. */
function assertValidLeadSource(source: string | null | undefined): void {
  if (source && !VALID_LEAD_SOURCES.includes(source)) {
    throw new BadRequestException(`Invalid leadSource '${source}'. Valid: ${VALID_LEAD_SOURCES.join(", ")}`);
  }
}

class CreateCustomerDto {
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  initialNote?: string;
}

class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}

class ListCustomersQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  customerType?: string;

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

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDirection?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  entitled?: string;
}

class CreateContactDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  inn?: string;
}

class CreatePartnerDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

/** REST API: /api/v1/customers → CRM Center (RBAC Phase 2). */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Post("customers")
  @RequirePermissions("crm.customer.write")
  createCustomer(@Body() dto: CreateCustomerDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.crm.createCustomer(dto, actor.username);
  }

  @Get("customers")
  @RequirePermissions("crm.customer.read")
  listCustomers(@Query() query: ListCustomersQuery) {
    return this.crm.listCustomers(query);
  }

  @Get("customers/export")
  @RequirePermissions("crm.customer.read")
  async exportCustomers(
    @Query() query: ListCustomersQuery & { format?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.crm.exportCustomers({
      status: query.status, customerType: query.customerType,
      search: query.search, dateFrom: query.dateFrom, dateTo: query.dateTo,
    });
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Code', key: 'code', width: 16 },
      { header: 'First Name', key: 'firstName', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Company', key: 'companyName', width: 28 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Customers');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="customers_export.xlsx"');
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers_export.csv"');
    return res.send(svc.toCsv(columns, rows));
  }

  @Get("customers/:id")
  @RequirePermissions("crm.customer.read")
  getCustomer(@Param("id") id: string) {
    return this.crm.getCustomer(id);
  }

  @Patch("customers/:id")
  @RequirePermissions("crm.customer.write")
  updateCustomer(@Param("id") id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.crm.updateCustomer(id, dto, actor.username);
  }

  @Get("customers/:id/contacts")
  @RequirePermissions("crm.customer.read")
  listContacts(@Param("id") id: string) {
    return this.crm.listContacts(id);
  }

  @Post("customers/:id/contacts")
  @RequirePermissions("crm.contact.write")
  createContact(@Param("id") id: string, @Body() dto: CreateContactDto) {
    return this.crm.createContact(id, dto);
  }

  @Get("companies")
  @RequirePermissions("crm.customer.read")
  listCompanies() {
    return this.crm.listCompanies();
  }

  @Post("companies")
  @RequirePermissions("crm.company.write")
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.crm.createCompany(dto.name, dto.inn);
  }

  @Post("partners")
  @RequirePermissions("crm.partner.write")
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.crm.createPartner(dto.name, dto.companyId, dto.countryCode);
  }

  @Get("suppliers")
  @RequirePermissions("crm.customer.read")
  listSuppliers() {
    return this.crm.listSuppliers();
  }

  @Post("suppliers")
  @RequirePermissions("crm.supplier.write")
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.crm.createSupplier(dto.name, dto.companyId);
  }

  // ── Step 3.5 — Partner List/Detail ──────────────────────────────────────

  @Get("partners")
  @RequirePermissions("crm.partner.read")
  listPartners(@Query() query: ListCustomersQuery) {
    return this.crm.listPartners(query);
  }

  @Get("partners/export")
  @RequirePermissions("crm.partner.read")
  async exportPartners(
    @Query() query: ListCustomersQuery & { format?: string; entitled?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.crm.exportPartners({
      status: query.status, search: query.search,
      entitled: query.entitled, dateFrom: query.dateFrom, dateTo: query.dateTo,
    });
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Code', key: 'code', width: 16 },
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Email', key: 'contactEmail', width: 28 },
      { header: 'Country', key: 'countryCode', width: 8 },
      { header: 'Reg Number', key: 'registrationNumber', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Partners');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="partners_export.xlsx"');
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="partners_export.csv"');
    return res.send(svc.toCsv(columns, rows));
  }

  @Get("partners/:id")
  @RequirePermissions("crm.partner.read")
  getPartner(
    @Param("id") id: string,
    @Query() query: { sortBy?: string; sortDirection?: string; status?: string; bookingStatus?: string; productStatus?: string; dateFrom?: string; dateTo?: string },
  ) {
    return this.crm.getPartner(id, { sortBy: query.sortBy, sortDirection: query.sortDirection, status: query.status, bookingStatus: query.bookingStatus, productStatus: query.productStatus, dateFrom: query.dateFrom, dateTo: query.dateTo });
  }

  // ── Step 3.5 — Customer Detail with relations ───────────────────────────

  @Get("customers/:id/detail")
  @RequirePermissions("crm.customer.read")
  getCustomerDetail(
    @Param("id") id: string,
    @Query() query: { sortBy?: string; sortDirection?: string; status?: string; bookingStatus?: string; paymentStatus?: string },
  ) {
    return this.crm.getCustomerDetail(id, { sortBy: query.sortBy, sortDirection: query.sortDirection, status: query.status, bookingStatus: query.bookingStatus, paymentStatus: query.paymentStatus });
  }

  // ── Customer 360 scoped exports (no pagination) ──────────────────────

  @Get("customers/:id/orders/export")
  @RequirePermissions("crm.customer.read")
  async exportCustomerOrders(
    @Param("id") id: string,
    @Query() query: { status?: string; format?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.crm.exportCustomerOrders(id, query.status);
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Reference', key: 'referenceNumber', width: 22 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Paid Amount', key: 'paidAmount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Partner', key: 'partnerName', width: 24 },
      { header: 'Created', key: 'createdAt', width: 22 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Customer Orders');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_orders.xlsx"`);
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_orders.csv"`);
    return res.send(svc.toCsv(columns, rows));
  }

  @Get("customers/:id/bookings/export")
  @RequirePermissions("crm.customer.read")
  async exportCustomerBookings(
    @Param("id") id: string,
    @Query() query: { bookingStatus?: string; format?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.crm.exportCustomerBookings(id, query.bookingStatus);
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Reference', key: 'referenceNumber', width: 22 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Order Reference', key: 'orderCode', width: 20 },
      { header: 'Order Number', key: 'orderNumber', width: 16 },
      { header: 'Service Date', key: 'serviceDate', width: 22 },
      { header: 'Created', key: 'createdAt', width: 22 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Customer Bookings');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_bookings.xlsx"`);
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_bookings.csv"`);
    return res.send(svc.toCsv(columns, rows));
  }

  @Get("customers/:id/payments/export")
  @RequirePermissions("crm.customer.read")
  async exportCustomerPayments(
    @Param("id") id: string,
    @Query() query: { paymentStatus?: string; format?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.crm.exportCustomerPayments(id, query.paymentStatus);
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Reference', key: 'referenceNumber', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Method', key: 'paymentMethod', width: 14 },
      { header: 'Order Reference', key: 'orderCode', width: 20 },
      { header: 'Order Number', key: 'orderNumber', width: 16 },
      { header: 'Paid At', key: 'paidAt', width: 22 },
      { header: 'Created', key: 'createdAt', width: 22 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Customer Payments');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_payments.xlsx"`);
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_payments.csv"`);
    return res.send(svc.toCsv(columns, rows));
  }

  @Get("customers/:id/partners/export")
  @RequirePermissions("crm.customer.read")
  async exportCustomerPartners(
    @Param("id") id: string,
    @Query() query: { format?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.crm.exportCustomerPartners(id);
    const columns = [
      { header: 'Partner ID', key: 'partnerId', width: 38 },
      { header: 'Partner Name', key: 'partnerName', width: 28 },
      { header: 'Status', key: 'partnerStatus', width: 14 },
      { header: 'Orders', key: 'orderCount', width: 10 },
      { header: 'Bookings', key: 'totalBookings', width: 10 },
      { header: 'Amount', key: 'totalAmount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Customer Partners');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_partners.xlsx"`);
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customer_${id}_partners.csv"`);
    return res.send(svc.toCsv(columns, rows));
  }

  // ── Step 3.5 Round 5 — Customer commercial partners from transactional activity ──

  @Get("customers/:id/partners")
  @RequirePermissions("crm.customer.read")
  getCustomerPartners(@Param("id") id: string) {
    return this.crm.getCustomerPartners(id);
  }

  // ── Step 3.5B — Partner Customer Relations ──────────────────────────────

  @Post("partners/:partnerId/customers/:customerId")
  @RequirePermissions("crm.partner.write")
  createPartnerCustomerRelation(
    @Param("partnerId") partnerId: string,
    @Param("customerId") customerId: string,
    @Body() dto: { leadSource?: string; assignedTo?: string; lifecycle?: string; tags?: string[]; notes?: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.crm.createPartnerCustomerRelation(partnerId, customerId, dto, actor.username);
  }

  @Patch("partner-customer-relations/:relationId")
  @RequirePermissions("crm.partner.write")
  updatePartnerCustomerRelation(
    @Param("relationId") relationId: string,
    @Body() dto: { status?: EntityStatus; lifecycle?: string; tags?: string[]; notes?: string; assignedTo?: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.crm.updatePartnerCustomerRelation(relationId, dto, actor.username);
  }

  // ── Step 3.5C — Three-Context Partner CRM ─────────────────────────────

  @Get("partner/customers")
  @RequirePermissions("crm.customer.read_own")
  listPartnerCustomers(
    @Query() query: ListCustomersQuery,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.crm.listPartnerCustomers(actor, query);
  }

  @Get("partner/customers/:id")
  @RequirePermissions("crm.customer.read_own")
  getPartnerCustomerDetail(
    @Param("id") id: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.crm.getPartnerCustomerDetail(id, actor);
  }

  @Get("partner/crm-tier")
  @RequirePermissions("crm.customer.read_own")
  getCrmTier(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.crm.getCrmTier(actor.partnerId ?? "").then((tier) => ({ tier }));
  }

  @Post("partner/customers/intake")
  @RequirePermissions("crm.customer.create_own")
  intakePartnerCustomer(
    @Body() dto: { firstName?: string; lastName?: string; companyName?: string; email: string; phone?: string; leadSource?: string; lifecycle?: string; tags?: string[]; notes?: string; assignedTo?: string; initialNote?: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertValidLeadSource(dto.leadSource);
    return this.crm.intakePartnerCustomer(actor, dto, actor.username);
  }

  @Patch("partner/relations/:relationId")
  @RequirePermissions("crm.customer.update_own")
  updatePartnerRelation(
    @Param("relationId") relationId: string,
    @Body() dto: { status?: EntityStatus; lifecycle?: string; tags?: string[]; notes?: string; assignedTo?: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.crm.updatePartnerRelation(relationId, actor, dto, actor.username);
  }

  // ── Step 3.5C — Platform CRM Admin Intake ──────────────────────────────

  /**
   * Platform CRM admin can intake a customer for ANY partner.
   * Unlike POST /partner/customers/intake (partner-context), this endpoint
   * uses an explicit partnerId path parameter and crm.partner.write permission.
   */
  @Post("partners/:partnerId/intake")
  @RequirePermissions("crm.partner.write")
  platformIntakeCustomer(
    @Param("partnerId") partnerId: string,
    @Body() dto: { firstName?: string; lastName?: string; companyName?: string; email: string; phone?: string; leadSource?: string; lifecycle?: string; tags?: string[]; notes?: string; assignedTo?: string; initialNote?: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertValidLeadSource(dto.leadSource);
    return this.crm.platformIntakeCustomer(partnerId, dto, actor.username);
  }
}

export { ValidateNested };
