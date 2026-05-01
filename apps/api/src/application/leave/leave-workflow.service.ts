import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalDecision, ApprovalStepType, LeaveStatus, Prisma } from "@prisma/client";
import type { DecideLeaveStepInput, SubmitLeaveRequestInput } from "@ewos/shared";
import { AuditContext } from "../../core/domain/audit.types";
import { AuditService } from "../audit/audit.service";
import { QueueService } from "../../infrastructure/queues/queue.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { NotificationsGateway } from "../../infrastructure/realtime/notifications.gateway";

@Injectable()
export class LeaveWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly queues: QueueService,
    private readonly notifications: NotificationsGateway
  ) {}

  async submit(input: SubmitLeaveRequestInput): Promise<{ id: string; status: LeaveStatus }> {
    const context = this.auditContext(input);
    const result = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, tenantId: input.tenantId, deletedAt: null },
        include: { manager: { include: { user: true } } }
      });
      if (!employee) {
        throw new NotFoundException("Employee not found");
      }
      if (!employee.manager) {
        throw new ConflictException("Employee has no manager configured for leave approval");
      }

      const request = await tx.leaveRequest.create({
        data: {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          reason: input.reason,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          approvalSteps: {
            create: {
              tenantId: input.tenantId,
              approverId: employee.manager.id,
              stepType: ApprovalStepType.MANAGER
            }
          }
        }
      });

      await this.audit.write(tx, context, {
        entityType: "LeaveRequest",
        entityId: request.id,
        action: "leave.submitted",
        afterSnapshot: request
      });

      return {
        request,
        managerUserId: employee.manager.userId
      };
    });

    await this.queues.enqueueEmail({
      tenantId: input.tenantId,
      recipientUserId: result.managerUserId,
      template: "leave-submitted",
      variables: { leaveRequestId: result.request.id }
    });
    this.notifications.emitToTenant(input.tenantId, "leave.updated", {
      leaveRequestId: result.request.id,
      status: result.request.status
    });

    return { id: result.request.id, status: result.request.status };
  }

  async decide(input: DecideLeaveStepInput): Promise<{ id: string; status: LeaveStatus }> {
    const context = this.auditContext(input);
    const outcome = await this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id: input.leaveRequestId, tenantId: input.tenantId, deletedAt: null },
        include: { employee: { include: { user: true } }, approvalSteps: true }
      });
      if (!request) {
        throw new NotFoundException("Leave request not found");
      }
      if (request.status !== LeaveStatus.PENDING) {
        throw new ConflictException("Leave request is no longer pending");
      }

      const step = request.approvalSteps.find((candidate) => candidate.decision === ApprovalDecision.PENDING);
      if (!step) {
        throw new ConflictException("No pending approval step");
      }
      if (step.approverId !== input.approverEmployeeId) {
        throw new ForbiddenException("Approver is not assigned to this step");
      }

      const stepUpdate = await tx.leaveApprovalStep.updateMany({
        where: {
          id: step.id,
          version: input.expectedVersion,
          decision: ApprovalDecision.PENDING
        },
        data: {
          decision: input.decision,
          comment: input.comment,
          decidedAt: new Date(),
          version: { increment: 1 }
        }
      });
      if (stepUpdate.count !== 1) {
        throw new ConflictException("Approval step was modified by another transaction");
      }

      if (input.decision === ApprovalDecision.REJECTED) {
        const rejected = await tx.leaveRequest.update({
          where: { id: request.id },
          data: { status: LeaveStatus.REJECTED, decidedAt: new Date(), version: { increment: 1 } }
        });
        await this.audit.write(tx, context, {
          entityType: "LeaveRequest",
          entityId: request.id,
          action: "leave.rejected",
          beforeSnapshot: request,
          afterSnapshot: rejected
        });
        return { request: rejected, notifyUserId: request.employee.userId, payroll: null };
      }

      if (step.stepType === ApprovalStepType.MANAGER) {
        const hrApprover = await this.findHrApprover(tx, input.tenantId);
        await tx.leaveApprovalStep.create({
          data: {
            tenantId: input.tenantId,
            leaveRequestId: request.id,
            approverId: hrApprover.id,
            stepType: ApprovalStepType.HR
          }
        });
        await this.audit.write(tx, context, {
          entityType: "LeaveRequest",
          entityId: request.id,
          action: "leave.manager_approved",
          beforeSnapshot: request,
          afterSnapshot: { nextStep: ApprovalStepType.HR, approverId: hrApprover.id }
        });
        return { request, notifyUserId: hrApprover.userId, payroll: null };
      }

      const approved = await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: LeaveStatus.APPROVED, decidedAt: new Date(), version: { increment: 1 } }
      });
      const idempotencyKey = `payroll:leave:${request.id}:approved`;
      const outbox = await tx.outboxEvent.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: "LeaveRequest",
          aggregateId: request.id,
          eventType: "leave.approved.payroll_sync",
          idempotencyKey,
          payload: {
            leaveRequestId: request.id,
            employeeId: request.employeeId,
            startsAt: request.startsAt.toISOString(),
            endsAt: request.endsAt.toISOString()
          }
        }
      });
      await this.audit.write(tx, context, {
        entityType: "LeaveRequest",
        entityId: request.id,
        action: "leave.hr_approved",
        beforeSnapshot: request,
        afterSnapshot: approved
      });
      return { request: approved, notifyUserId: request.employee.userId, payroll: { outboxEventId: outbox.id, idempotencyKey } };
    });

    if (outcome.payroll) {
      await this.queues.enqueuePayrollSync({
        tenantId: input.tenantId,
        leaveRequestId: input.leaveRequestId,
        outboxEventId: outcome.payroll.outboxEventId,
        idempotencyKey: outcome.payroll.idempotencyKey
      });
    }
    await this.queues.enqueueEmail({
      tenantId: input.tenantId,
      recipientUserId: outcome.notifyUserId,
      template: outcome.request.status === LeaveStatus.REJECTED ? "leave-rejected" : "leave-approved",
      variables: { leaveRequestId: outcome.request.id }
    });
    this.notifications.emitToTenant(input.tenantId, "leave.updated", {
      leaveRequestId: outcome.request.id,
      status: outcome.request.status
    });
    return { id: outcome.request.id, status: outcome.request.status };
  }

  private async findHrApprover(tx: Prisma.TransactionClient, tenantId: string): Promise<{ id: string; userId: string }> {
    const approver = await tx.employee.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        user: {
          roles: {
            some: {
              role: { code: "HR" }
            }
          }
        }
      },
      select: { id: true, userId: true }
    });
    if (!approver) {
      throw new ConflictException("No HR approver configured");
    }
    return approver;
  }

  private auditContext(input: { tenantId: string; actorUserId: string; traceId: string; ipAddress?: string; userAgent?: string }): AuditContext {
    return {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      traceId: input.traceId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    };
  }
}
