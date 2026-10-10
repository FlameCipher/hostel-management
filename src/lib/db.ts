import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function normalizeDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const sslMode = url.searchParams.get("sslmode");

  // node-postgres warns that legacy aliases will change semantics in a future
  // major release. Keep TLS enabled and make full certificate verification explicit.
  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

function createPrismaClient() {
  const rawConnectionString = process.env.DB_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!rawConnectionString) {
    throw new Error("DB_DATABASE_URL or DATABASE_URL is not configured");
  }

  const connectionString = normalizeDatabaseUrl(rawConnectionString);
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
