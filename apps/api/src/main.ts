import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { createStructuredLogger } from "./infrastructure/observability/logger";

async function bootstrap(): Promise<void> {
  const logger = createStructuredLogger();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ["error", "warn", "log"]
  });
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 4000);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    })
  );
  app.use(cookieParser(config.get<string>("AUTH_SECRET", "dev-secret-change-before-shipping")));
  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    credentials: true
  });

  await app.listen(port);
  logger.info("api.started", { port });
}

void bootstrap();

