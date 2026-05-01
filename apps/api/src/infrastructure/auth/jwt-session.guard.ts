import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";

@Injectable()
export class JwtSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    request.user = await this.auth.resolveBearerToken(header.slice("Bearer ".length));
    return true;
  }
}

