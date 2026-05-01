import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiInsightsModule } from "./application/ai/ai-insights.module";
import { AuditModule } from "./application/audit/audit.module";
import { DashboardModule } from "./application/dashboard/dashboard.module";
import { EmployeeModule } from "./application/employees/employee.module";
import { HealthModule } from "./application/health/health.module";
import { LeaveModule } from "./application/leave/leave.module";
import { RuleModule } from "./application/rules/rule.module";
import { AuthModule } from "./infrastructure/auth/auth.module";
import { CsrfMiddleware } from "./infrastructure/auth/csrf.middleware";
import { RequestContextMiddleware } from "./infrastructure/observability/request-context.middleware";
import { CacheInfrastructureModule } from "./infrastructure/cache/cache.module";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { QueueInfrastructureModule } from "./infrastructure/queues/queue.module";
import { RealtimeModule } from "./infrastructure/realtime/realtime.module";

const nodeEnv = process.env["NODE_ENV"];
const envFilePath = nodeEnv === "production" ? ".env.prod" : nodeEnv === "staging" ? ".env.staging" : ".env.dev";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [envFilePath, ".env"] }),
    DatabaseModule,
    CacheInfrastructureModule,
    QueueInfrastructureModule,
    RealtimeModule,
    AuthModule,
    HealthModule,
    AuditModule,
    DashboardModule,
    EmployeeModule,
    LeaveModule,
    RuleModule,
    AiInsightsModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: "health", method: RequestMethod.GET },
        { path: "auth/(.*)", method: RequestMethod.ALL }
      )
      .forRoutes("*");
  }
}
