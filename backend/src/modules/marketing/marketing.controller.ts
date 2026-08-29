import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MarketingService } from './marketing.service';
import { JwtAuthGuard } from '../../security/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../security/auth/permissions.guard';
import { CurrentUser, RequirePermissions } from '../../security/auth/decorators';
import type { AuthedRequest } from '../../security/auth/jwt-auth.guard';
import { CampaignObjective, CampaignStatus } from '../../generated/prisma/enums';

// ── DTOs ───────────────────────────────────────────────────────────

class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;
}

class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;
}

class TransitionCampaignDto {
  @IsEnum(CampaignStatus)
  status!: CampaignStatus;
}

class CreateAudienceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  criteria?: Record<string, unknown>;

  @IsString()
  campaignId!: string;
}

class CreateAttributionDto {
  @IsString()
  campaignId!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  attributionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── Controller ─────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  // ── Campaign endpoints ─────────────────────────────────────────

  @Post('campaigns')
  @RequirePermissions('marketing.campaign.create')
  createCampaign(@Body() dto: CreateCampaignDto, @CurrentUser() actor: AuthedRequest['user']) {
    return this.marketing.createCampaign(actor, dto);
  }

  @Get('campaigns')
  @RequirePermissions('marketing.campaign.read')
  listCampaigns(
    @CurrentUser() actor: AuthedRequest['user'],
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.marketing.listCampaigns(actor, page ? parseInt(page) : 1, pageSize ? parseInt(pageSize) : 20);
  }

  @Get('campaigns/:id')
  @RequirePermissions('marketing.campaign.read')
  getCampaign(@Param('id') id: string, @CurrentUser() actor: AuthedRequest['user']) {
    return this.marketing.getCampaign(actor, id);
  }

  @Patch('campaigns/:id')
  @RequirePermissions('marketing.campaign.update')
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.marketing.updateCampaign(actor, id, dto);
  }

  @Post('campaigns/:id/transition')
  @RequirePermissions('marketing.campaign.update')
  transitionCampaign(
    @Param('id') id: string,
    @Body() dto: TransitionCampaignDto,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.marketing.transitionCampaign(actor, id, dto);
  }

  @Delete('campaigns/:id')
  @RequirePermissions('marketing.campaign.delete')
  deleteCampaign(@Param('id') id: string, @CurrentUser() actor: AuthedRequest['user']) {
    return this.marketing.deleteCampaign(actor, id);
  }

  // ── Audience endpoints ─────────────────────────────────────────

  @Post('audiences')
  @RequirePermissions('marketing.audience.manage')
  createAudience(@Body() dto: CreateAudienceDto, @CurrentUser() actor: AuthedRequest['user']) {
    return this.marketing.createAudience(actor, dto);
  }

  @Get('campaigns/:campaignId/audiences')
  @RequirePermissions('marketing.audience.read')
  listAudiences(
    @Param('campaignId') campaignId: string,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.marketing.listAudiences(actor, campaignId);
  }

  @Get('audiences/:id')
  @RequirePermissions('marketing.audience.read')
  getAudience(@Param('id') id: string, @CurrentUser() actor: AuthedRequest['user']) {
    return this.marketing.getAudience(actor, id);
  }

  // ── Attribution endpoints ──────────────────────────────────────

  @Post('attributions')
  @RequirePermissions('marketing.attribution.manage')
  createAttribution(@Body() dto: CreateAttributionDto, @CurrentUser() actor: AuthedRequest['user']) {
    return this.marketing.createAttribution(actor, dto);
  }

  @Get('campaigns/:campaignId/attributions')
  @RequirePermissions('marketing.attribution.read')
  listAttributions(
    @Param('campaignId') campaignId: string,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.marketing.listAttributions(actor, campaignId);
  }

  @Get('attributions/entity/:entityType/:entityId')
  @RequirePermissions('marketing.attribution.read')
  listAttributionsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    return this.marketing.listAttributionsByEntity(actor, entityType, entityId);
  }
}
