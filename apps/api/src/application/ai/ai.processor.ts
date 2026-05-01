import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";
import { RedisService } from "../../infrastructure/cache/redis.service";
import type { AiProcessingJob } from "../../infrastructure/queues/queue.types";
import { AiInsightsService } from "./ai-insights.service";

@Injectable()
export class AiProcessor implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<AiProcessingJob>;

  constructor(
    private readonly redis: RedisService,
    private readonly insights: AiInsightsService
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<AiProcessingJob>(
      "ai-processing",
      async (job: Job<AiProcessingJob>) => {
        await this.insights.generateInsight(job.data.request);
      },
      { connection: this.redis.connection, concurrency: 2 }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

