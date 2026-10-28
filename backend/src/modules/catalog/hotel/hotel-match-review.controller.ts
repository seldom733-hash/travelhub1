import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { HotelMatchReviewService } from "./hotel-match-review.service";
import { JwtAuthGuard, type AuthedRequest } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";

/**
 * Ручная проверка сопоставления отелей (дубликатов).
 *
 * Просмотр — catalog.product.read; изменение реестра (слияние/разъединение) —
 * catalog.product.write. Права `catalog.product.update` в RBAC нет: опечатка в
 * ранней версии делала merge/split недоступными (PermissionsGuard fail-closed).
 */
@Controller("catalog/hotel-matching")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HotelMatchReviewController {
  constructor(private readonly review: HotelMatchReviewService) {}

  /** Кандидаты на слияние: похожие названия в одном городе, разные Hotel.id. */
  @Get("candidates")
  @RequirePermissions("catalog.product.read")
  async candidates(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.review.findCandidates(
      limit ? Number.parseInt(limit, 10) : 50,
      offset ? Number.parseInt(offset, 10) : 0,
    );
  }

  /** Слить дубликат в канонический отель (перенос refs + удаление дубликата). */
  @Post("merge")
  @RequirePermissions("catalog.product.write")
  async merge(
    @Body() body: { canonicalId?: string; duplicateId?: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    if (!body?.canonicalId || !body?.duplicateId) {
      return { ok: false, message: "canonicalId и duplicateId обязательны" };
    }
    return this.review.mergeHotels(body.canonicalId, body.duplicateId, actor);
  }

  /** Разъединить: вынести один supplier-ref в новый отель. */
  @Post("split")
  @RequirePermissions("catalog.product.write")
  async split(@Body() body: { refId?: string }, @CurrentUser() actor: AuthedRequest["user"]) {
    if (!body?.refId) return { ok: false, message: "refId обязателен" };
    return this.review.splitHotel(body.refId, actor);
  }

  /** Все supplier-привязки отеля — evidence для карточки ревью. */
  @Get("hotels/:hotelId/refs")
  @RequirePermissions("catalog.product.read")
  async refs(@Param("hotelId") hotelId: string) {
    return this.review.listRefs(hotelId);
  }
}
