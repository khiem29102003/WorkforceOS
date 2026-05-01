import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { changeSalarySchema, createEmployeeSchema, listEmployeesSchema, updateEmployeeSchema } from "@ewos/shared";
import type { ChangeSalaryInput, CreateEmployeeInput, ListEmployeesInput, UpdateEmployeeInput } from "@ewos/shared";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import { JwtSessionGuard } from "../../infrastructure/auth/jwt-session.guard";
import { ApiRateLimitGuard } from "../../infrastructure/auth/rate-limit.guard";
import { Roles } from "../../infrastructure/auth/roles.decorator";
import { RolesGuard } from "../../infrastructure/auth/roles.guard";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";
import { ZodValidationPipe } from "../../interfaces/http/zod-validation.pipe";
import { ChangeSalaryBody, changeSalaryBodySchema, CreateEmployeeBody, createEmployeeBodySchema, ListEmployeesQuery, listEmployeesQuerySchema, UpdateEmployeeBody, updateEmployeeBodySchema } from "./dto/employee.dto";
import { EmployeeService } from "./employee.service";

@Controller("employees")
@UseGuards(JwtSessionGuard, ApiRateLimitGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employees: EmployeeService) {}

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.PM)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listEmployeesQuerySchema)) query: ListEmployeesQuery
  ) {
    const input: ListEmployeesInput = listEmployeesSchema.parse({ ...query, tenantId: user.tenantId });
    return this.employees.list(input);
  }

  @Post()
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithAuth,
    @Body(new ZodValidationPipe(createEmployeeBodySchema)) body: CreateEmployeeBody
  ) {
    const input: CreateEmployeeInput = createEmployeeSchema.parse({ ...body, ...this.auditContext(user, request) });
    return this.employees.create(input);
  }

  @Patch(":employeeId")
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithAuth,
    @Param("employeeId") employeeId: string,
    @Body(new ZodValidationPipe(updateEmployeeBodySchema)) body: UpdateEmployeeBody
  ) {
    const input: UpdateEmployeeInput = updateEmployeeSchema.parse({ ...body, employeeId, ...this.auditContext(user, request) });
    return this.employees.update(input);
  }

  @Patch(":employeeId/salary")
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  changeSalary(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithAuth,
    @Param("employeeId") employeeId: string,
    @Body(new ZodValidationPipe(changeSalaryBodySchema)) body: ChangeSalaryBody
  ) {
    const input: ChangeSalaryInput = changeSalarySchema.parse({ ...body, employeeId, ...this.auditContext(user, request) });
    return this.employees.changeSalary(input);
  }

  @Delete(":employeeId")
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithAuth,
    @Param("employeeId") employeeId: string,
    @Query("expectedVersion") expectedVersion: string
  ) {
    return this.employees.softDelete({
      employeeId,
      expectedVersion: Number(expectedVersion),
      ...this.auditContext(user, request)
    });
  }

  private auditContext(user: AuthenticatedUser, request: RequestWithAuth): { tenantId: string; actorUserId: string; traceId: string; ipAddress?: string; userAgent?: string } {
    return {
      tenantId: user.tenantId,
      actorUserId: user.userId,
      traceId: request.traceId ?? "missing-trace-id",
      ipAddress: request.ip,
      userAgent: request.header("user-agent")
    };
  }
}

