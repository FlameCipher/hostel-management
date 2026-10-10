import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DB_DATABASE_URL_UNPOOLED
  ?? process.env.DB_DATABASE_URL
  ?? process.env.DATABASE_URL;

// Prisma generate does not connect to the database, but Prisma 7 loads this
// config during generation. Preview builds may intentionally omit database
// credentials, so provide a non-routable placeholder only for schema/client
// generation. Runtime database access still requires the real environment
// variable in src/lib/db.ts.
const datasourceUrl = databaseUrl ?? "postgresql://build:build@127.0.0.1:5432/build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
