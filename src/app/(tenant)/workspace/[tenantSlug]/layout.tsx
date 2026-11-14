import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getTenantForUser } from "@/server/tenants/queries";

export default async function WorkspaceLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const user = await requireUser(`/workspace/${tenantSlug}`);
  const tenant = await getTenantForUser(tenantSlug, user.id);
  if (!tenant) notFound();
  return <>{children}</>;
}
