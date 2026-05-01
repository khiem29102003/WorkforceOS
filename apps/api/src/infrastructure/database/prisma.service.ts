import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL", "postgresql://ewos:ewos@localhost:5432/workforce_os?schema=public");
    super({
      adapter: new PrismaPg({ connectionString }),
      log: [
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" }
      ]
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
