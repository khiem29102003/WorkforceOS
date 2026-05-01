import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env["DATABASE_URL"] ?? "postgresql://ewos:ewos@localhost:5432/workforce_os?schema=public";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
    { emit: "stdout", level: "warn" }
  ]
});

export type DatabaseClient = typeof prisma;
