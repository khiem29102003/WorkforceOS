import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const request = context.switchToHttp().getRequest<RequestWithAuth>();
  if (!request.user) {
    throw new UnauthorizedException("Missing authenticated user");
  }
  return request.user;
});
