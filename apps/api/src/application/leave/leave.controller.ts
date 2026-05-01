import { Body, Controller, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { decideLeaveStepSchema, submitLeaveRequestSchema } from "@ewos/shared";
import type { DecideLeaveStepInput, SubmitLeaveRequestInput } from "@ewos/shared";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import { JwtSessionGuard } from "../../infrastructure/auth/jwt-session.guard";
import { ApiRateLimitGuard } from "../../infrastructure/auth/rate-limit.guard";
import { Roles } from "../../infrastructure/auth/roles.decorator";
import { RolesGuard } from "../../infrastructure/auth/roles.guard";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";
import { ZodValidationPipe } from "../../interfaces/http/zod-validation.pipe";
import { DecideLeaveBody, decideLeaveBodySchema, SubmitLeaveBody, submitLeaveBodySchema } from "./leave.dto";
import { LeaveWorkflowService } from "./leave-workflow.service";

@Controller("leave-requests")
@UseGuards(JwtSessionGuard, ApiRateLimitGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leave: LeaveWorkflowService) {}

  @Post()
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.PM, RoleCode.EMPLOYEE)
  submit(@CurrentUser() user: AuthenticatedUser, @Req() request: RequestWithAuth, @Body(new ZodValidationPipe(submitLeaveBodySchema)) body: SubmitLeaveBody) {
    const input: SubmitLeaveRequestInput = submitLeaveRequestSchema.parse({ ...body, ...this.auditContext(user, request) });
    return this.leave.submit(input);
  }

  @Patch(":leaveRequestId/decision")
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.PM)
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithAuth,
    @Param("leaveRequestId") leaveRequestId: string,
    @Body(new ZodValidationPipe(decideLeaveBodySchema)) body: DecideLeaveBody
  ) {
    const input: DecideLeaveStepInput = decideLeaveStepSchema.parse({ ...body, leaveRequestId, ...this.auditContext(user, request) });
    return this.leave.decide(input);
  }

  private auditContext(user: AuthenticatedUser, request: RequestWithAuth): { tenantId: string; actorUserId: string; traceId: string; ipAddress?: string; userAgent?: string } {
    return {
      tenantId: user.tenantId,
      actorUserId: user.userId,
      traceId: request.traceId ?? "missing-trace-id-0000",
      ipAddress: request.ip,
      userAgent: request.header("user-agent")
    };
  }
}

