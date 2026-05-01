import type { AiInsightRequest } from "@ewos/shared";

export interface EmailNotificationJob {
  tenantId: string;
  recipientUserId: string;
  template: "leave-submitted" | "leave-approved" | "leave-rejected";
  variables: Record<string, string>;
}

export interface PayrollSyncJob {
  tenantId: string;
  leaveRequestId: string;
  outboxEventId: string;
  idempotencyKey: string;
}

export interface AiProcessingJob {
  request: AiInsightRequest;
  idempotencyKey: string;
}

