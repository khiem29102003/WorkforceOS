import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiInsightsService } from "./ai-insights.service";
import { AiProcessor } from "./ai.processor";

@Module({
  controllers: [AiController],
  providers: [AiInsightsService, AiProcessor],
  exports: [AiInsightsService]
})
export class AiInsightsModule {}

