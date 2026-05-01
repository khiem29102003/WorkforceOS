import type { z } from "zod";
import { changeSalarySchema, createEmployeeSchema, listEmployeesSchema, updateEmployeeSchema } from "@ewos/shared";

const contextKeys = {
  tenantId: true,
  actorUserId: true,
  traceId: true,
  ipAddress: true,
  userAgent: true
} as const;

export const createEmployeeBodySchema = createEmployeeSchema.omit(contextKeys);
export const updateEmployeeBodySchema = updateEmployeeSchema.omit({
  ...contextKeys,
  employeeId: true
});
export const changeSalaryBodySchema = changeSalarySchema.omit({
  ...contextKeys,
  employeeId: true
});
export const listEmployeesQuerySchema = listEmployeesSchema.omit({ tenantId: true });

export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>;
export type ChangeSalaryBody = z.infer<typeof changeSalaryBodySchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
