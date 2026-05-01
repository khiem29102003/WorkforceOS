import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ChangeSalaryInput, CreateEmployeeInput, ListEmployeesInput, UpdateEmployeeInput } from "@ewos/shared";
import { AuditContext } from "../../core/domain/audit.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RedisService } from "../../infrastructure/cache/redis.service";

type EmployeeWithUser = Prisma.EmployeeGetPayload<{ include: { user: { select: { id: true; email: true; name: true } } } }>;

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService
  ) {}

  async list(input: ListEmployeesInput): Promise<EmployeeWithUser[]> {
    const cacheKey = `query:employees:${input.tenantId}:${input.department ?? "all"}:${input.limit}:${input.cursor ?? "first"}:${input.includeDeleted}`;
    const cached = await this.redis.getJson<EmployeeWithUser[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId: input.tenantId,
        department: input.department,
        deletedAt: input.includeDeleted ? undefined : null
      },
      include: { user: { select: { id: true, email: true, name: true } } },
      cursor: input.cursor ? { id: input.cursor } : undefined,
      take: input.limit,
      orderBy: [{ department: "asc" }, { employeeNumber: "asc" }]
    });

    await this.redis.setJson(cacheKey, employees, 30);
    return employees;
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeWithUser> {
    const context = this.auditContext(input);
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          managerId: input.managerId,
          employeeNumber: input.employeeNumber,
          title: input.title,
          department: input.department,
          employmentStatus: input.employmentStatus,
          startDate: input.startDate,
          probationEndsAt: input.probationEndsAt,
          weeklyCapacityHours: input.weeklyCapacityHours,
          createdById: input.actorUserId,
          updatedById: input.actorUserId
        },
        include: { user: { select: { id: true, email: true, name: true } } }
      });
      await this.audit.write(tx, context, {
        entityType: "Employee",
        entityId: employee.id,
        action: "employee.created",
        afterSnapshot: employee
      });
      return employee;
    });
  }

  async update(input: UpdateEmployeeInput): Promise<EmployeeWithUser> {
    const context = this.auditContext(input);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employee.findFirst({
        where: { id: input.employeeId, tenantId: input.tenantId, deletedAt: null },
        include: { user: { select: { id: true, email: true, name: true } } }
      });
      if (!before) {
        throw new NotFoundException("Employee not found");
      }
      const updateResult = await tx.employee.updateMany({
        where: {
          id: input.employeeId,
          tenantId: input.tenantId,
          deletedAt: null,
          version: input.expectedVersion
        },
        data: {
          managerId: input.managerId,
          title: input.title,
          department: input.department,
          employmentStatus: input.employmentStatus,
          probationEndsAt: input.probationEndsAt,
          weeklyCapacityHours: input.weeklyCapacityHours,
          updatedById: input.actorUserId,
          version: { increment: 1 }
        }
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("Employee was modified by another transaction");
      }
      const after = await tx.employee.findUniqueOrThrow({
        where: { id: input.employeeId },
        include: { user: { select: { id: true, email: true, name: true } } }
      });
      await this.audit.write(tx, context, {
        entityType: "Employee",
        entityId: input.employeeId,
        action: "employee.updated",
        beforeSnapshot: before,
        afterSnapshot: after
      });
      return after;
    });
  }

  async changeSalary(input: ChangeSalaryInput): Promise<void> {
    const context = this.auditContext(input);
    await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, tenantId: input.tenantId, deletedAt: null }
      });
      if (!employee) {
        throw new NotFoundException("Employee not found");
      }

      const updateResult = await tx.employee.updateMany({
        where: {
          id: input.employeeId,
          tenantId: input.tenantId,
          version: input.expectedVersion,
          deletedAt: null
        },
        data: {
          version: { increment: 1 },
          updatedById: input.actorUserId
        }
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("Employee salary was modified by another transaction");
      }

      await tx.salaryHistory.updateMany({
        where: {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          effectiveTo: null,
          deletedAt: null
        },
        data: { effectiveTo: input.effectiveFrom }
      });

      const salaryRecord = await tx.salaryHistory.create({
        data: {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          annualSalaryCents: input.annualSalaryCents,
          currency: input.currency,
          effectiveFrom: input.effectiveFrom,
          reason: input.reason,
          approvedById: input.approvedById
        }
      });

      await this.audit.write(tx, context, {
        entityType: "SalaryHistory",
        entityId: salaryRecord.id,
        action: "salary.changed",
        beforeSnapshot: employee,
        afterSnapshot: salaryRecord
      });
    });
  }

  async softDelete(input: { tenantId: string; employeeId: string; actorUserId: string; traceId: string; ipAddress?: string; userAgent?: string; expectedVersion: number }): Promise<void> {
    const context = this.auditContext(input);
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.employee.findFirst({ where: { id: input.employeeId, tenantId: input.tenantId, deletedAt: null } });
      if (!before) {
        throw new NotFoundException("Employee not found");
      }
      const updateResult = await tx.employee.updateMany({
        where: { id: input.employeeId, tenantId: input.tenantId, version: input.expectedVersion, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 }, updatedById: input.actorUserId }
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("Employee was modified by another transaction");
      }
      await this.audit.write(tx, context, {
        entityType: "Employee",
        entityId: input.employeeId,
        action: "employee.deleted",
        beforeSnapshot: before
      });
    });
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

