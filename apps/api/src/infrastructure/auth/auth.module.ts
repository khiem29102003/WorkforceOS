import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { ApiRateLimitGuard } from "./rate-limit.guard";
import { JwtSessionGuard } from "./jwt-session.guard";
import { RolesGuard } from "./roles.guard";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtSessionGuard, RolesGuard, ApiRateLimitGuard],
  exports: [AuthService, JwtSessionGuard, RolesGuard, ApiRateLimitGuard]
})
export class AuthModule {}
