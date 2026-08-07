import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CustomerType, EntityStatus } from "../../generated/prisma/enums";
import { CrmService } from "./crm.service";

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
}

class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

/** REST API: /api/v1/customers → CRM Center. */
@Controller()
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Post("customers")
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.crm.createCustomer(dto, "api");
  }

  @Get("customers")
  listCustomers(@Query() query: ListCustomersQuery) {
    return this.crm.listCustomers(query);
  }

  @Get("customers/:id")
  getCustomer(@Param("id") id: string) {
    return this.crm.getCustomer(id);
  }

  @Patch("customers/:id")
  updateCustomer(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.crm.updateCustomer(id, dto, "api");
  }

  @Get("customers/:id/contacts")
  listContacts(@Param("id") id: string) {
    return this.crm.listContacts(id);
  }

  @Post("customers/:id/contacts")
  createContact(@Param("id") id: string, @Body() dto: CreateContactDto) {
    return this.crm.createContact(id, dto);
  }

  @Get("companies")
  listCompanies() {
    return this.crm.listCompanies();
  }

  @Post("companies")
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.crm.createCompany(dto.name, dto.inn);
  }

  @Post("partners")
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.crm.createPartner(dto.name, dto.companyId);
  }

  @Get("suppliers")
  listSuppliers() {
    return this.crm.listSuppliers();
  }

  @Post("suppliers")
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.crm.createSupplier(dto.name, dto.companyId);
  }
}

export { ValidateNested };
