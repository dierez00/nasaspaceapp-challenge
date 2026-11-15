import "server-only";

import { cache } from "react";
import { getPrisma } from "@/server/db/prisma";

export const getTenantForUser = cache(async (slug: string, userId: string) => {
  return getPrisma().tenant.findFirst({
    where: { slug, memberships: { some: { userId } } },
    include: { memberships: { where: { userId }, select: { role: true } } },
  });
});

export async function getFirstTenantForUser(userId: string) {
  return getPrisma().tenantMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { tenant: true },
  });
}

export const isPlatformAdmin = cache(async (userId: string) => {
  return Boolean(await getPrisma().platformAdmin.findUnique({ where: { userId } }));
});
