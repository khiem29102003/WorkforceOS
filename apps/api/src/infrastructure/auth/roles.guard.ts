import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleCode } from "@prisma/client";
import { REQUIRED_ROLES_KEY } from "./roles.decorator";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[]>(REQUIRED_ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const roles = request.user?.roles ?? [];
    const allowed = required.some((role) => roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}

