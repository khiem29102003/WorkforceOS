import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../../interfaces/http/zod-validation.pipe";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";
import { PrismaService } from "../database/prisma.service";
import { ApiRateLimitGuard } from "./rate-limit.guard";
import { AuthService } from "./auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type LoginBody = z.infer<typeof loginSchema>;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService
  ) {}

  @Post("login")
  @UseGuards(ApiRateLimitGuard)
  async login(@Req() request: RequestWithAuth, @Body(new ZodValidationPipe(loginSchema)) body: LoginBody) {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email.toLowerCase(), deletedAt: null },
      include: { tenant: true }
    });
    if (!user || !(await this.auth.verifyPassword(user.passwordHash, body.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await this.auth.issueJwt(user.id, user.tenantId);
    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        email: user.email,
        name: user.name,
        accessToken
      },
      traceId: request.traceId
    };
  }
}
