import { z } from "zod";
import { auditActorSchema, tenantScopedSchema, uuidSchema } from "./common";

export const leaveStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export const approvalDecisionSchema = z.enum(["APPROVED", "REJECTED"]);

export const submitLeaveRequestBaseSchema = tenantScopedSchema
  .extend({
    employeeId: uuidSchema,
    reason: z.string().trim().min(8).max(1000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date()
  })
  .merge(auditActorSchema);

export const submitLeaveRequestSchema = submitLeaveRequestBaseSchema.refine((value: z.infer<typeof submitLeaveRequestBaseSchema>) => value.endsAt >= value.startsAt, {
  message: "Leave end date must be on or after start date",
  path: ["endsAt"]
});

export const decideLeaveStepSchema = tenantScopedSchema
  .extend({
    leaveRequestId: uuidSchema,
    approverEmployeeId: uuidSchema,
    expectedVersion: z.coerce.number().int().positive(),
    decision: approvalDecisionSchema,
    comment: z.string().trim().max(1000).optional()
  })
  .merge(auditActorSchema);

export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;
export type DecideLeaveStepInput = z.infer<typeof decideLeaveStepSchema>;
