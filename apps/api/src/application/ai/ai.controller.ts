import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { aiInsightRequestSchema } from "@ewos/shared";
import type { AiInsightRequest } from "@ewos/shared";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import { JwtSessionGuard } from "../../infrastructure/auth/jwt-session.guard";
import { ApiRateLimitGuard } from "../../infrastructure/auth/rate-limit.guard";
import { Roles } from "../../infrastructure/auth/roles.decorator";
import { RolesGuard } from "../../infrastructure/auth/roles.guard";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";
import { ZodValidationPipe } from "../../interfaces/http/zod-validation.pipe";
import { AiInsightsService } from "./ai-insights.service";

const aiInsightBodySchema = aiInsightRequestSchema.omit({
  tenantId: true,
  requesterUserId: true
});

type AiInsightBody = Omit<AiInsightRequest, "tenantId" | "requesterUserId">;

@Controller("ai/insights")
@UseGuards(JwtSessionGuard, ApiRateLimitGuard, RolesGuard)
export class AiController {
  constructor(private readonly insights: AiInsightsService) {}

  @Post()
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.PM)
  request(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(aiInsightBodySchema)) body: AiInsightBody) {
    return this.insights.requestInsight(
      aiInsightRequestSchema.parse({
        ...body,
        tenantId: user.tenantId,
        requesterUserId: user.userId
      })
    );
  }
}

