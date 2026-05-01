import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { NotificationsGateway } from "../../infrastructure/realtime/notifications.gateway";

export interface RuleEvaluation {
  ruleKey: "overtime-weekly" | "probation-restricted";
  severity: "info" | "warning" | "critical";
  employeeId: string;
  message: string;
  facts: Record<string, string | number | boolean>;
}

@Injectable()
export class RuleEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway
  ) {}

  async evaluateWeeklyWorkload(input: { tenantId: string; employeeId: string; weekStart: Date }): Promise<RuleEvaluation[]> {
    const [employee, aggregate] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: input.employeeId, tenantId: input.tenantId, deletedAt: null }
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          weekStart: input.weekStart
        },
        _sum: { hours: true }
      })
    ]);

    if (!employee) {
      return [];
    }

    const evaluations: RuleEvaluation[] = [];
    const totalHours = Number(aggregate._sum.hours ?? 0);
    if (totalHours > employee.weeklyCapacityHours) {
      evaluations.push({
        ruleKey: "overtime-weekly",
        severity: totalHours > 50 ? "critical" : "warning",
        employeeId: employee.id,
        message: "Employee exceeded configured weekly capacity",
        facts: {
          totalHours,
          weeklyCapacityHours: employee.weeklyCapacityHours
        }
      });
    }

    if (employee.employmentStatus === "PROBATION") {
      evaluations.push({
        ruleKey: "probation-restricted",
        severity: "info",
        employeeId: employee.id,
        message: "Probation employee has restricted permissions",
        facts: {
          probationEndsAt: employee.probationEndsAt?.toISOString() ?? "unknown"
        }
      });
    }

    for (const evaluation of evaluations) {
      this.notifications.emitToTenant(input.tenantId, "rule.alert", {
        employeeId: evaluation.employeeId,
        ruleKey: evaluation.ruleKey,
        severity: evaluation.severity,
        facts: evaluation.facts
      });
    }

    return evaluations;
  }
}

