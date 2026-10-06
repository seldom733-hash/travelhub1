/**
 * Supplier Markup (STRICT PROMPT §23/§24) — PricingController (admin master data).
 *
 * RBAC: ТОЛЬКО канонические pricing.markup.read / pricing.markup.manage
 * (permissions.constants PERMISSIONS + ROLE_PERMISSIONS: read — DIRECTOR/
 * FINANCE/ANALYST; manage — FINANCE/ADMIN). НЕ зависит от supplier.search.*
 * (undeclared → fail-closed 403, audit дефект; Gate J).
 */
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { MarkupMatrixService } from "./markup-matrix.service";
import { MarkupRuleService } from "./markup-rule.service";
import {
  CreateMarkupRuleDto,
  MARKUP_RULE_FORBIDDEN_KEYS,
  MarkupRuleListQueryDto,
  ResolveMarkupRuleQueryDto,
  UpdateMarkupRuleDto,
} from "./pricing.validation";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("pricing")
export class PricingController {
  constructor(
    private readonly markupRules: MarkupRuleService,
    private readonly matrix: MarkupMatrixService,
  ) {}

  // ── Supplier × Service markup matrix (§4.1, pricing.markup.read) ──────────

  @Get("markup-matrix")
  @RequirePermissions("pricing.markup.read")
  async getMarkupMatrix() {
    return this.matrix.build();
  }

  // ── MarkupRule read (pricing.markup.read) ──────────────────────────────────

  @Get("markup-rules")
  @RequirePermissions("pricing.markup.read")
  async listMarkupRules(@Query() query: MarkupRuleListQueryDto) {
    return this.markupRules.list(query);
  }

  // NOTE: resolve MUST be declared before ":code" route (Nest order).
  @Get("markup-rules/resolve")
  @RequirePermissions("pricing.markup.read")
  async resolveMarkupRule(@Query() query: ResolveMarkupRuleQueryDto) {
    return this.markupRules.resolve(query.supplierCode, query.serviceType, new Date(query.at));
  }

  @Get("markup-rules/:code")
  @RequirePermissions("pricing.markup.read")
  async getMarkupRule(@Param("code") code: string) {
    return this.markupRules.getByCode(code);
  }

  @Get("markup-rules/:code/history")
  @RequirePermissions("pricing.markup.read")
  async getMarkupRuleHistory(@Param("code") code: string) {
    return this.markupRules.history(code);
  }

  // ── MarkupRule lifecycle (pricing.markup.manage) ───────────────────────────

  @Post("markup-rules")
  @RequirePermissions("pricing.markup.manage")
  async createMarkupRule(@Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: CreateMarkupRuleDto) {
    assertNoForbiddenKeys(req.body, MARKUP_RULE_FORBIDDEN_KEYS);
    return this.markupRules.create(
      { supplierCode: dto.supplierCode, serviceType: dto.serviceType, rate: dto.rate, effectiveFrom: dto.effectiveFrom, effectiveTo: dto.effectiveTo },
      { id: actor.id, username: actor.username },
    );
  }

  @Patch("markup-rules/:code")
  @RequirePermissions("pricing.markup.manage")
  async updateMarkupRule(@Param("code") code: string, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: UpdateMarkupRuleDto) {
    assertNoForbiddenKeys(req.body, MARKUP_RULE_FORBIDDEN_KEYS);
    return this.markupRules.update(
      code,
      { rate: dto.rate, effectiveFrom: dto.effectiveFrom, effectiveTo: dto.effectiveTo, expectedVersion: dto.expectedVersion },
      { id: actor.id, username: actor.username },
    );
  }

  @Post("markup-rules/:code/activate")
  @RequirePermissions("pricing.markup.manage")
  async activateMarkupRule(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.markupRules.activate(code, { id: actor.id, username: actor.username });
  }

  @Post("markup-rules/:code/archive")
  @RequirePermissions("pricing.markup.manage")
  async archiveMarkupRule(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.markupRules.archive(code, { id: actor.id, username: actor.username });
  }
}
