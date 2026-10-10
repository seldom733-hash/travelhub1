import { Module } from "@nestjs/common";
import { GuestCheckoutController } from "./guest-checkout.controller";
import { GuestCheckoutService } from "./guest-checkout.service";
import { RequestModule } from "../order/request.module";
import { CrmModule } from "../crm/crm.module";

/**
 * M4.5 §23 — Guest Checkout (net-new surface; audit: no /checkout existed).
 *
 * Public entry point для anonymous visitor:
 *
 *   Оформить заказ → onboarding (email/phone/FIO) → Customer Resolver
 *     → Customer (create или reuse, ниогда не merge) → Request → Order (staff-assisted)
 *
 * Канонические правила M4:
 *  - customerId — единственный commerce owner (§22/§24); phone/email — только
 *    ключи резолва, никогда owner;
 *  - passport/traveler data для идентичности НЕ требуются (§23); travelerCount
 *    (размер партии) — не PII и нужен для D3-конверсии;
 *  - CheckoutIntent (staff-side коммерческий конвейер Quote→Sale) НЕ используется:
 *    guest входит в canonical Request→Order pipeline; интеграция CheckoutIntent
 *    остаётся на будущее при реальной точке их пересечения;
 *  - anonymous endpoint: @Public + LoginThrottleService (per-IP окно);
 *  - пароли/аккаунты не создаются (option B): guest — только Customer;
 *    регистрация остаётся отдельным явным действием.
 */
@Module({
  imports: [RequestModule, CrmModule],
  controllers: [GuestCheckoutController],
  providers: [GuestCheckoutService],
})
export class CheckoutModule {}
