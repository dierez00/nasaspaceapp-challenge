import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/shared/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient() {
  const adapter = new PrismaPg({ connectionString: getServerEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

let prisma: PrismaClient | undefined;

// Page discovery imports server modules during builds, before a database is needed.
export function getPrisma() {
  prisma ??= globalForPrisma.prisma ?? buildClient();

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

  return prisma;
}
