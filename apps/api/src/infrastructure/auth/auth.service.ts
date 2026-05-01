import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RoleCode } from "@prisma/client";
import argon2 from "argon2";
import { jwtVerify, SignJWT } from "jose";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";
import { RedisService } from "../cache/redis.service";
import { PrismaService } from "../database/prisma.service";

interface JwtPayload {
  sub: string;
  tenantId: string;
}

@Injectable()
export class AuthService {
  private readonly secret: Uint8Array;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService
  ) {
    this.secret = new TextEncoder().encode(config.get<string>("AUTH_SECRET", "dev-secret-change-before-shipping"));
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async issueJwt(userId: string, tenantId: string): Promise<string> {
    return new SignJWT({ tenantId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(this.secret);
  }

  async resolveBearerToken(token: string): Promise<AuthenticatedUser> {
    const verified = await jwtVerify(token, this.secret);
    const payload = verified.payload as unknown as Partial<JwtPayload>;
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException("Invalid token");
    }

    const cacheKey = `session:${payload.tenantId}:${payload.sub}`;
    const cached = await this.redis.getJson<AuthenticatedUser>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, deletedAt: null },
      include: {
        employee: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException("Unknown user");
    }

    const authUser: AuthenticatedUser = {
      userId: user.id,
      tenantId: user.tenantId,
      employeeId: user.employee?.id,
      roles: user.roles.map((userRole) => userRole.role.code as RoleCode),
      permissions: user.roles.flatMap((userRole) => userRole.role.permissions.map((rolePermission) => rolePermission.permission.key))
    };
    await this.redis.setJson(cacheKey, authUser, 300);
    return authUser;
  }
}

