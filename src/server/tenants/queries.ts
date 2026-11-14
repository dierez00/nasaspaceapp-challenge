import "server-only";

import { cache } from "react";
import { prisma } from "@/server/db/prisma";

export const getTenantForUser = cache(async (slug: string, userId: string) => {
  return prisma.tenant.findFirst({
    where: { slug, memberships: { some: { userId } } },
    include: { memberships: { where: { userId }, select: { role: true } } },
  });
});

export async function getFirstTenantForUser(userId: string) {
  return prisma.tenantMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { tenant: true },
  });
}

export const isPlatformAdmin = cache(async (userId: string) => {
  return Boolean(await prisma.platformAdmin.findUnique({ where: { userId } }));
});
