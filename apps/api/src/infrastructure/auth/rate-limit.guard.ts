import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../cache/redis.service";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const userKey = request.user?.userId ?? request.ip ?? "anonymous";
    const route = `${request.method}:${request.route?.path ?? request.path}`;
    const result = await this.redis.rateLimit(`rate:${userKey}:${route}`, 120, 60);
    if (!result.allowed) {
      throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
