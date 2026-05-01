import type { z } from "zod";
import { decideLeaveStepSchema, submitLeaveRequestBaseSchema } from "@ewos/shared";

const contextKeys = {
  tenantId: true,
  actorUserId: true,
  traceId: true,
  ipAddress: true,
  userAgent: true
} as const;

const submitLeaveBodyBaseSchema = submitLeaveRequestBaseSchema.omit(contextKeys);

export const submitLeaveBodySchema = submitLeaveBodyBaseSchema.refine((value: z.infer<typeof submitLeaveBodyBaseSchema>) => value.endsAt >= value.startsAt, {
  message: "Leave end date must be on or after start date",
  path: ["endsAt"]
});
export const decideLeaveBodySchema = decideLeaveStepSchema.omit({
  ...contextKeys,
  leaveRequestId: true
});

export type SubmitLeaveBody = z.infer<typeof submitLeaveBodySchema>;
export type DecideLeaveBody = z.infer<typeof decideLeaveBodySchema>;
