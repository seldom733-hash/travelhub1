import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SecurityService } from "./security.service";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import { UsersController } from "./users.controller";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";

/**
 * SecurityModule — @Global(): guards/services доступны во всех доменных модулях
 * (каждый контроллер использует @UseGuards(JwtAuthGuard, PermissionsGuard)).
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as never },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [SecurityService, AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [SecurityService, AuthService, JwtAuthGuard, PermissionsGuard],
})
export class SecurityModule {}
