import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { RequirePermissions, CurrentUser } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { DocumentsService } from "./documents.service";
import { canViewTravelerPii } from "../../shared/pii";
import { redactTravelerPii } from "../../shared/pii";
import type { DocumentStatus, DocumentType } from "../../generated/prisma/client";

/**
 * DocumentsController — D13 document endpoints.
 *
 * Buyer Cabinet: own-scope (account.document.read_own).
 * Admin/Operator: full access (documents.read / documents.write).
 */
@Controller("")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermissions("account.document.read_own")
  @Get("account/documents")
  async listOwnDocuments(
    @CurrentUser() user: AuthedRequest["user"],
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.documents.listBuyerDocuments(user.id, p, ps);
  }

  @RequirePermissions("account.document.read_own")
  @Get("account/documents/:id/download")
  async downloadOwnDocument(
    @CurrentUser() user: AuthedRequest["user"],
    @Param("id") id: string,
    @Res() res: any,
  ) {
    const { url } = await this.documents.getDownloadUrl(id, user.id, user.role);
    return res.redirect(url);
  }

  @RequirePermissions("documents.read")
  @Get("documents")
  async listDocuments(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("type") type?: DocumentType,
    @Query("status") status?: DocumentStatus,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.documents.listAllDocuments(p, ps, type, status);
  }

  @RequirePermissions("documents.read")
  @Get("documents/:id")
  async getDocument(
    @CurrentUser() user: AuthedRequest["user"],
    @Param("id") id: string,
  ) {
    const doc = await this.documents.getDocument(id);
    if (!canViewTravelerPii(user.role as any)) {
      if (doc.versions?.[0]?.snapshot) {
        const snapshot = doc.versions[0].snapshot as Record<string, unknown>;
        const travelers = snapshot.travelers as Array<Record<string, unknown>> | undefined;
        if (travelers) {
          (snapshot as any).travelers = travelers.map((t) => redactTravelerPii(t, { role: user.role as any }));
        }
      }
    }
    return doc;
  }

  @RequirePermissions("documents.read")
  @Get("documents/:id/download")
  async downloadDocument(
    @CurrentUser() user: AuthedRequest["user"],
    @Param("id") id: string,
    @Res() res: any,
  ) {
    const { url } = await this.documents.getDownloadUrl(id, user.id, user.role);
    return res.redirect(url);
  }

  @RequirePermissions("documents.write")
  @Post("documents/:id/invalidate")
  async invalidateDocument(
    @CurrentUser() user: AuthedRequest["user"],
    @Param("id") id: string,
    @Body("reason") reason: string,
  ) {
    await this.documents.invalidateDocument(this.documents["prisma"], id, `Manual void by ${user.id}: ${reason}`);
    return { success: true };
  }
}
