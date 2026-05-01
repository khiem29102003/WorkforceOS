import { Controller, Get, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import { JwtSessionGuard } from "../../infrastructure/auth/jwt-session.guard";
import { ApiRateLimitGuard } from "../../infrastructure/auth/rate-limit.guard";
import { Roles } from "../../infrastructure/auth/roles.decorator";
import { RolesGuard } from "../../infrastructure/auth/roles.guard";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";
import { PrismaService } from "../../infrastructure/database/prisma.service";

@Controller("dashboard")
@UseGuards(JwtSessionGuard, ApiRateLimitGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.PM)
  async summary(@CurrentUser() user: AuthenticatedUser) {
    const [activeEmployees, pendingApprovals, failedOutbox] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId: user.tenantId, deletedAt: null, employmentStatus: { not: "TERMINATED" } } }),
      this.prisma.leaveApprovalStep.count({ where: { tenantId: user.tenantId, decision: "PENDING" } }),
      this.prisma.outboxEvent.count({ where: { tenantId: user.tenantId, status: "FAILED" } })
    ]);

    const pendingLeave = await this.prisma.leaveRequest.findMany({
      where: { tenantId: user.tenantId, status: "PENDING", deletedAt: null },
      include: {
        employee: { include: { user: true } },
        approvalSteps: { orderBy: { createdAt: "asc" } }
      },
      take: 5,
      orderBy: { submittedAt: "asc" }
    });

    return {
      degraded: false,
      metrics: [
        { label: "Active employees", value: String(activeEmployees), delta: "tenant scope", tone: "good" },
        { label: "Pending approvals", value: String(pendingApprovals), delta: "manager and HR", tone: pendingApprovals > 10 ? "warn" : "neutral" },
        { label: "Payroll sync failures", value: String(failedOutbox), delta: "outbox monitor", tone: failedOutbox > 0 ? "warn" : "good" },
        { label: "Burnout risk", value: "Policy driven", delta: "AI cache enabled", tone: "neutral" }
      ],
      leaveQueue: pendingLeave.map((leave) => ({
        id: leave.id,
        employee: leave.employee.user.name,
        status: leave.status,
        step: leave.approvalSteps.some((approvalStep) => approvalStep.stepType === "HR" && approvalStep.decision === "PENDING") ? "HR approval" : "Manager approval",
        timeline: this.timelineFor(leave.approvalSteps)
      })),
      riskSignals: [
        {
          id: "outbox-failures",
          label: failedOutbox > 0 ? "Payroll outbox has failed jobs" : "Payroll outbox is healthy",
          severity: failedOutbox > 0 ? "critical" : "info"
        }
      ]
    };
  }

  private timelineFor(approvalSteps: Array<{ stepType: "MANAGER" | "HR"; decision: "PENDING" | "APPROVED" | "REJECTED" }>) {
    const manager = approvalSteps.find((step) => step.stepType === "MANAGER");
    const hr = approvalSteps.find((step) => step.stepType === "HR");
    const rejected = approvalSteps.some((step) => step.decision === "REJECTED");
    return [
      { label: "Employee", status: "done" },
      { label: "Manager", status: this.stepStatus(manager?.decision, false) },
      { label: "HR", status: manager?.decision === "APPROVED" ? this.stepStatus(hr?.decision, false) : "waiting" },
      { label: "Done", status: rejected ? "rejected" : hr?.decision === "APPROVED" ? "done" : "waiting" }
    ];
  }

  private stepStatus(decision: "PENDING" | "APPROVED" | "REJECTED" | undefined, isTerminal: boolean): "done" | "current" | "waiting" | "rejected" {
    if (decision === "APPROVED") {
      return "done";
    }
    if (decision === "REJECTED") {
      return "rejected";
    }
    if (decision === "PENDING" || isTerminal) {
      return "current";
    }
    return "waiting";
  }
}
