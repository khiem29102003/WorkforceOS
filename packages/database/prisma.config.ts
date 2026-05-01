import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"] ?? "postgresql://ewos:ewos@localhost:5432/workforce_os?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/seed.ts"
  },
  datasource: {
    url: databaseUrl
  }
});
