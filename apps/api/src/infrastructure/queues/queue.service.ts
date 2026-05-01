import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";
import { RedisService } from "../cache/redis.service";
import type { AiProcessingJob, EmailNotificationJob, PayrollSyncJob } from "./queue.types";

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800 }
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly emailQueue: Queue<EmailNotificationJob>;
  readonly payrollQueue: Queue<PayrollSyncJob>;
  readonly aiQueue: Queue<AiProcessingJob>;

  constructor(redis: RedisService) {
    this.emailQueue = new Queue<EmailNotificationJob>("email-notifications", {
      connection: redis.connection,
      defaultJobOptions
    });
    this.payrollQueue = new Queue<PayrollSyncJob>("payroll-sync", {
      connection: redis.connection,
      defaultJobOptions
    });
    this.aiQueue = new Queue<AiProcessingJob>("ai-processing", {
      connection: redis.connection,
      defaultJobOptions
    });
  }

  async enqueueEmail(job: EmailNotificationJob): Promise<void> {
    await this.emailQueue.add(job.template, job, {
      jobId: `${job.template}:${job.tenantId}:${job.recipientUserId}:${JSON.stringify(job.variables)}`
    });
  }

  async enqueuePayrollSync(job: PayrollSyncJob): Promise<void> {
    await this.payrollQueue.add("sync-approved-leave", job, {
      jobId: job.idempotencyKey
    });
  }

  async enqueueAiProcessing(job: AiProcessingJob): Promise<void> {
    await this.aiQueue.add(job.request.type, job, {
      jobId: job.idempotencyKey
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.emailQueue.close(), this.payrollQueue.close(), this.aiQueue.close()]);
  }
}

