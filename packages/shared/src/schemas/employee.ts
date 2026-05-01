import { z } from "zod";
import { auditActorSchema, paginationSchema, tenantScopedSchema, uuidSchema } from "./common";

export const employmentStatusSchema = z.enum(["ACTIVE", "PROBATION", "TERMINATED"]);

export const createEmployeeSchema = tenantScopedSchema
  .extend({
    userId: uuidSchema,
    managerId: uuidSchema.optional(),
    employeeNumber: z.string().trim().min(2).max(32),
    title: z.string().trim().min(2).max(120),
    department: z.string().trim().min(2).max(120),
    employmentStatus: employmentStatusSchema.default("PROBATION"),
    startDate: z.coerce.date(),
    probationEndsAt: z.coerce.date().optional(),
    weeklyCapacityHours: z.coerce.number().int().min(1).max(80).default(40)
  })
  .merge(auditActorSchema);

export const updateEmployeeSchema = tenantScopedSchema
  .extend({
    employeeId: uuidSchema,
    expectedVersion: z.coerce.number().int().positive(),
    managerId: uuidSchema.nullable().optional(),
    title: z.string().trim().min(2).max(120).optional(),
    department: z.string().trim().min(2).max(120).optional(),
    employmentStatus: employmentStatusSchema.optional(),
    probationEndsAt: z.coerce.date().nullable().optional(),
    weeklyCapacityHours: z.coerce.number().int().min(1).max(80).optional()
  })
  .merge(auditActorSchema);

export const changeSalarySchema = tenantScopedSchema
  .extend({
    employeeId: uuidSchema,
    expectedVersion: z.coerce.number().int().positive(),
    annualSalaryCents: z.coerce.bigint().positive(),
    currency: z.string().trim().length(3).default("USD"),
    effectiveFrom: z.coerce.date(),
    reason: z.string().trim().min(8).max(500),
    approvedById: uuidSchema.optional()
  })
  .merge(auditActorSchema);

export const listEmployeesSchema = tenantScopedSchema.merge(paginationSchema).extend({
  department: z.string().trim().min(1).max(120).optional(),
  includeDeleted: z.coerce.boolean().default(false)
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ChangeSalaryInput = z.infer<typeof changeSalarySchema>;
export type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;

