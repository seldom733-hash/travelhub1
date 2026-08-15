import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SecurityService } from "./security.service";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import { UsersController } from "./users.controller";
import { AccountService } from "./account/account.service";
import { AccountController } from "./account/account.controller";
import { PartnerOnboardingService } from "./partner/partner-onboarding.service";
import { PartnerOnboardingController } from "./partner/partner-onboarding.controller";
import { LoginThrottleService } from "../shared/login-throttle.service";
import { CrmModule } from "../modules/crm/crm.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";

/**
 * SecurityModule — @Global(): guards/services доступны во всех доменных модулях
 * (каждый контроллер использует @UseGuards(JwtAuthGuard, PermissionsGuard)).
 * Step 1.9: CrmModule импортирован для CRM-owned Buyer↔Customer orchestration
 * (AccountService/AuthService вызывают CrmService как application service;
 * security НЕ пишет в crm.* напрямую).
 *
 * Step 1.10: PartnerOnboardingService/Controller — own-scope заявки + review
 * queue. Approve-оркестрация (CRM create-or-link Partner + User.partnerId)
 * задокументирована ADR-0004 (отдельный разрешённый contract, НЕ наследует
 * ADR-0003 Buyer exception).
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as never },
    }),
    CrmModule,
  ],
  controllers: [AuthController, UsersController, AccountController, PartnerOnboardingController],
  providers: [SecurityService, AuthService, AccountService, PartnerOnboardingService, JwtAuthGuard, PermissionsGuard, LoginThrottleService],
  exports: [SecurityService, AuthService, JwtAuthGuard, PermissionsGuard, LoginThrottleService],
})
export class SecurityModule {}
