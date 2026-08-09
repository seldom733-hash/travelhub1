import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CustomerType, EntityStatus } from "../../generated/prisma/enums";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

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
}

export { ValidateNested };
