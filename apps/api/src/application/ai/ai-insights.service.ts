import { createHash } from "node:crypto";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { AiInsightType, Prisma } from "@prisma/client";
import type { AiInsightRequest } from "@ewos/shared";
import { QueueService } from "../../infrastructure/queues/queue.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RedisService } from "../../infrastructure/cache/redis.service";
import { NotificationsGateway } from "../../infrastructure/realtime/notifications.gateway";

interface TeamMemberContext {
  employeeId: string;
  title: string;
  department: string;
  employmentStatus: string;
  performanceScore: number;
  weeklyHours: number;
  allocationPercent: number;
}

export interface WorkforceAiInput {
  tenantId: string;
  projectId?: string;
  type: AiInsightType;
  generatedAt: string;
  teamPerformance: number[];
  workload: number[];
  team: TeamMemberContext[];
  project?: {
    id: string;
    key: string;
    name: string;
    status: string;
    healthScore: number;
  };
}

export interface WorkforceAiOutput {
  burnoutRisk: "low" | "medium" | "high";
  suggestion: string;
  confidence: number;
  drivers: Array<{
    signal: string;
    employeeId?: string;
    value: number | string;
  }>;
  actions: string[];
}

export interface AiInsightResult {
  status: "QUEUED" | "READY";
  cacheKey: string;
  result?: WorkforceAiOutput;
}

@Injectable()
export class AiInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queues: QueueService,
    private readonly notifications: NotificationsGateway
  ) {}

  async requestInsight(request: AiInsightRequest): Promise<AiInsightResult> {
    const usage = await this.redis.rateLimit(`rate:ai:${request.tenantId}:${request.requesterUserId}`, Number(process.env["AI_RATE_LIMIT_PER_HOUR"] ?? 25), 3_600);
    if (!usage.allowed) {
      throw new HttpException("AI usage limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    const input = await this.buildStructuredInput(request);
    const inputHash = this.hash(input);
    const cacheKey = `ai:${request.tenantId}:${request.type}:${inputHash}`;
    const cached = await this.redis.getJson<WorkforceAiOutput>(cacheKey);
    if (cached && !request.forceRefresh) {
      return { status: "READY", cacheKey, result: cached };
    }

    const existing = await this.prisma.aiInsight.findUnique({
      where: { tenantId_type_inputHash: { tenantId: request.tenantId, type: request.type, inputHash } }
    });
    if (existing && existing.expiresAt > new Date() && !request.forceRefresh) {
      const result = existing.result as unknown as WorkforceAiOutput;
      await this.redis.setJson(cacheKey, result, 900);
      return { status: "READY", cacheKey, result };
    }

    await this.queues.enqueueAiProcessing({
      idempotencyKey: `ai:${request.tenantId}:${request.type}:${inputHash}`,
      request
    });
    return { status: "QUEUED", cacheKey };
  }

  async generateInsight(request: AiInsightRequest): Promise<void> {
    const input = await this.buildStructuredInput(request);
    const inputHash = this.hash(input);
    const result = this.evaluate(input);
    const cacheKey = `ai:${request.tenantId}:${request.type}:${inputHash}`;

    await this.prisma.aiInsight.upsert({
      where: { tenantId_type_inputHash: { tenantId: request.tenantId, type: request.type, inputHash } },
      update: {
        model: "ewos-policy-engine-v1",
        structuredInput: input as unknown as Prisma.InputJsonObject,
        result,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdById: request.requesterUserId
      },
      create: {
        tenantId: request.tenantId,
        projectId: request.projectId,
        type: request.type,
        inputHash,
        model: "ewos-policy-engine-v1",
        structuredInput: input as unknown as Prisma.InputJsonObject,
        result,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdById: request.requesterUserId
      }
    });
    await this.redis.setJson(cacheKey, result, 900);
    this.notifications.emitToTenant(request.tenantId, "ai.insight.ready", {
      type: request.type,
      projectId: request.projectId,
      cacheKey
    });
  }

  private async buildStructuredInput(request: AiInsightRequest): Promise<WorkforceAiInput> {
    const project = request.projectId
      ? await this.prisma.project.findFirst({
          where: { id: request.projectId, tenantId: request.tenantId, deletedAt: null },
          include: {
            assignments: {
              include: {
                employee: {
                  include: {
                    timeEntries: {
                      orderBy: { weekStart: "desc" },
                      take: 4
                    }
                  }
                }
              }
            }
          }
        })
      : null;

    const employees = project
      ? project.assignments.map((assignment) => ({
          employee: assignment.employee,
          allocationPercent: assignment.allocationPercent
        }))
      : (await this.prisma.employee.findMany({
          where: { tenantId: request.tenantId, deletedAt: null },
          include: {
            timeEntries: {
              orderBy: { weekStart: "desc" },
              take: 4
            }
          },
          take: 50
        })).map((employee) => ({ employee, allocationPercent: 100 }));

    const team = employees.map(({ employee, allocationPercent }) => {
      const weeklyHours = employee.timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0) / Math.max(employee.timeEntries.length, 1);
      const performanceScore = project ? project.healthScore : Math.max(55, 100 - Math.max(0, weeklyHours - 40) * 4);
      return {
        employeeId: employee.id,
        title: employee.title,
        department: employee.department,
        employmentStatus: employee.employmentStatus,
        performanceScore,
        weeklyHours,
        allocationPercent
      };
    });

    return {
      tenantId: request.tenantId,
      projectId: request.projectId,
      type: request.type,
      generatedAt: new Date().toISOString(),
      teamPerformance: team.map((member) => member.performanceScore),
      workload: team.map((member) => member.weeklyHours),
      project: project
        ? {
            id: project.id,
            key: project.key,
            name: project.name,
            status: project.status,
            healthScore: project.healthScore
          }
        : undefined,
      team
    };
  }

  private evaluate(input: WorkforceAiInput): Prisma.InputJsonObject {
    const overloaded = input.team.filter((member) => member.weeklyHours > 42 || member.allocationPercent > 90);
    const probation = input.team.filter((member) => member.employmentStatus === "PROBATION");
    const averagePerformance = this.average(input.teamPerformance);
    const averageWorkload = this.average(input.workload);
    const departments = new Map<string, number>();
    for (const member of input.team) {
      departments.set(member.department, (departments.get(member.department) ?? 0) + 1);
    }

    if (input.type === AiInsightType.BURNOUT_RISK) {
      return {
        burnoutRisk: overloaded.length > 2 || averageWorkload > 46 ? "high" : overloaded.length > 0 || averageWorkload > 40 ? "medium" : "low",
        suggestion: overloaded.length > 0 ? "Reduce allocation or redistribute after-hours support load." : "Maintain current staffing load.",
        confidence: this.confidence(input.team.length, input.workload.length),
        drivers: overloaded.map((member) => ({
          signal: "workload_above_policy",
          employeeId: member.employeeId,
          value: `${member.weeklyHours}h / ${member.allocationPercent}% allocation`
        })),
        actions: overloaded.length > 0 ? ["Rebalance assignments", "Add backup owner", "Review overtime trend next week"] : ["Continue monitoring"]
      };
    }

    if (input.type === AiInsightType.TEAM_RESTRUCTURE) {
      return {
        burnoutRisk: averageWorkload > 44 ? "medium" : "low",
        suggestion: averagePerformance < 70 ? "Split overloaded ownership and pair low-coverage departments." : "Keep team structure stable and add succession coverage for small departments.",
        confidence: this.confidence(input.team.length, input.teamPerformance.length),
        drivers: Array.from(departments.entries()).map(([department, count]) => ({
          signal: count < 2 ? "single_point_of_failure" : "coverage_stable",
          value: `${department}:${count}`
        })),
        actions: probation.length > 0 ? ["Avoid assigning probation employees as sole approvers", "Pair probation employees with senior owners"] : ["Review department coverage monthly"]
      };
    }

    return {
      burnoutRisk: overloaded.length > 0 ? "medium" : "low",
      suggestion: overloaded.length > 0 ? "Delivery risk is rising because workload indicators are above policy thresholds." : "Execution indicators are within policy thresholds.",
      confidence: this.confidence(input.team.length, input.workload.length),
      project: input.project?.name ?? "Portfolio",
      status: input.project?.status ?? "ACTIVE",
      healthScore: input.project?.healthScore ?? 75,
      drivers: [
        { signal: "average_performance", value: Math.round(averagePerformance) },
        { signal: "average_workload", value: Math.round(averageWorkload) }
      ],
      actions: overloaded.length > 0 ? ["Review allocation", "Add backup approver", "Rebalance sprint commitments"] : ["Continue monitoring", "Refresh insight after next reporting period"]
    };
  }

  private average(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private confidence(teamSize: number, sampleSize: number): number {
    return Math.min(0.95, Math.max(0.45, 0.55 + Math.min(teamSize, sampleSize) * 0.04));
  }

  private hash(input: WorkforceAiInput): string {
    return createHash("sha256").update(JSON.stringify({ ...input, generatedAt: undefined })).digest("hex");
  }
}
