import { z } from "zod";
import { tenantScopedSchema, uuidSchema } from "./common";

export const aiInsightTypeSchema = z.enum(["TEAM_RESTRUCTURE", "BURNOUT_RISK", "PROJECT_PROGRESS"]);

export const aiInsightRequestSchema = tenantScopedSchema.extend({
  type: aiInsightTypeSchema,
  projectId: uuidSchema.optional(),
  requesterUserId: uuidSchema,
  forceRefresh: z.boolean().default(false)
});

export type AiInsightRequest = z.infer<typeof aiInsightRequestSchema>;

