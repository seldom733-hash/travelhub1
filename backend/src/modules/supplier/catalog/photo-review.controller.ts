import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../../../security/auth/decorators";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { PhotoReviewService } from "./photo-review.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("supplier/catalog/photo-review")
export class PhotoReviewController {
  constructor(private readonly reviews: PhotoReviewService) {}

  @Get()
  @RequirePermissions("supplier.search.manage")
  list() {
    return this.reviews.list();
  }

  @Post(":id/approve")
  @RequirePermissions("supplier.search.manage")
  approve(@Param("id") id: string) {
    return this.reviews.approve(id);
  }

  @Post(":id/reject")
  @RequirePermissions("supplier.search.manage")
  reject(@Param("id") id: string) {
    return this.reviews.reject(id);
  }
}
