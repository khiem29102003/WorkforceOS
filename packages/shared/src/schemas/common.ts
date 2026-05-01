import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const tenantScopedSchema = z.object({
  tenantId: uuidSchema
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const auditActorSchema = z.object({
  actorUserId: uuidSchema,
  traceId: z.string().min(16).max(128),
  ipAddress: z.string().max(128).optional(),
  userAgent: z.string().max(512).optional()
});

export type AuditActor = z.infer<typeof auditActorSchema>;

