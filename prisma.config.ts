import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DB_DATABASE_URL_UNPOOLED
  ?? process.env.DB_DATABASE_URL
  ?? process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DB_DATABASE_URL_UNPOOLED, DB_DATABASE_URL or DATABASE_URL must be configured");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
