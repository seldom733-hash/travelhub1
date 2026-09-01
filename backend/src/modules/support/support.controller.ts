import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../shared/export/export.service';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportService, CreateCaseDto, UpdateCaseDto, TransitionCaseDto, AssignCaseDto, EscalateCaseDto, CreateCommentDto } from './support.service';
import { JwtAuthGuard } from '../../security/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../security/auth/permissions.guard';
import { CurrentUser, RequirePermissions } from '../../security/auth/decorators';
import type { AuthedRequest } from '../../security/auth/jwt-auth.guard';
import { SupportCasePriority, SupportCaseStatus, SupportCaseType } from '../../generated/prisma/enums';

// ── DTOs ──────────────────────────────────────────────────────────────

class CreateCaseBody {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(SupportCaseType)
  caseType?: SupportCaseType;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;
}

class UpdateCaseBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(SupportCaseType)
  caseType?: SupportCaseType;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @IsString()
  source?: string;
}

class TransitionCaseBody {
  @IsEnum(SupportCaseStatus)
  status!: SupportCaseStatus;
}

class AssignCaseBody {
  @IsString()
  assignedToId!: string;
}

class EscalateCaseBody {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  escalationReason!: string;
}

class SoftDeleteCaseBody {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}

class CreateCommentBody {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

// ── Controller ────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('cases')
  @RequirePermissions('support.case.create')
  createCase(@Body() dto: CreateCaseBody, @CurrentUser() actor: AuthedRequest['user']) {
    return this.support.createCase(actor, dto);
  }

  @Get('cases/export')
  @RequirePermissions('support.case.read')
  async exportCases(
    @CurrentUser() actor: AuthedRequest['user'],
    @Query('format') format?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('caseType') caseType?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('customerId') customerId?: string,
    @Res() res?: Response,
  ) {
    const result = await this.support.listCases(actor, 1, 999999, { status, priority, caseType, assignedToId, customerId });
    const items = (result as any).items ?? result;
    const rows = (Array.isArray(items) ? items : []).map((c: any) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      status: c.status,
      priority: c.priority,
      caseType: c.caseType,
      customerId: c.customerId ?? '',
      assignedToId: c.assignedToId ?? '',
      createdBy: c.createdBy?.username ?? c.createdById,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Code', key: 'code', width: 16 },
      { header: 'Title', key: 'title', width: 32 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Type', key: 'caseType', width: 16 },
      { header: 'Customer ID', key: 'customerId', width: 38 },
      { header: 'Assigned To', key: 'assignedToId', width: 28 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Support Cases');
      res!.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res!.setHeader('Content-Disposition', 'attachment; filename="support_cases_export.xlsx"');
      return res!.send(buf);
    }
    const csv = svc.toCsv(columns, rows);
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', 'attachment; filename="support_cases_export.csv"');
    return res!.send(csv);
  }

  @Get('cases')
  @RequirePermissions('support.case.read')
  listCases(
    @CurrentUser() actor: AuthedRequest['user'],
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('caseType') caseType?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.support.listCases(
      actor,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
      { status, priority, caseType, assignedToId, customerId },
    );
  }

  @Get('cases/:id')
  @RequirePermissions('support.case.read')
  getCase(@Param('id') id: string, @CurrentUser() actor: AuthedRequest['user']) {
    return this.support.getCase(actor, id);
  }

  @Get('cases/code/:code')
  @RequirePermissions('support.case.read')
  getCaseByCode(@Param('code') code: string, @CurrentUser() actor: AuthedRequest['user']) {
    return this.support.getCaseByCode(actor, code);
  }

  @Patch('cases/:id')
  @RequirePermissions('support.case.update')
  updateCase(
    @Param('id') id: string,
    @Body() dto: UpdateCaseBody,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.updateCase(actor, id, dto);
  }

  @Post('cases/:id/transition')
  @RequirePermissions('support.case.update')
  transitionCase(
    @Param('id') id: string,
    @Body() dto: TransitionCaseBody,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.transitionCase(actor, id, dto);
  }

  @Post('cases/:id/assign')
  @RequirePermissions('support.case.assign')
  assignCase(
    @Param('id') id: string,
    @Body() dto: AssignCaseBody,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.assignCase(actor, id, dto);
  }

  @Post('cases/:id/escalate')
  @RequirePermissions('support.case.update')
  escalateCase(
    @Param('id') id: string,
    @Body() dto: EscalateCaseBody,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.escalateCase(actor, id, dto);
  }

  @Post('cases/:id/comments')
  @RequirePermissions('support.case.update')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentBody,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.addComment(actor, id, dto);
  }

  @Post('cases/:id/communications/:communicationId')
  @RequirePermissions('support.case.update')
  linkCommunication(
    @Param('id') id: string,
    @Param('communicationId') communicationId: string,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.linkCommunication(actor, id, communicationId);
  }

  @Post('cases/:id/delete')
  @RequirePermissions('support.case.delete')
  softDeleteCase(
    @Param('id') id: string,
    @Body() dto: SoftDeleteCaseBody,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.support.softDeleteCase(actor, id, dto.reason);
  }

  @Get('stats')
  @RequirePermissions('support.case.read')
  getStats() {
    return this.support.getStats();
  }
}
