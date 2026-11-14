import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { isPlatformAdmin } from "@/server/tenants/queries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (!(await isPlatformAdmin(user.id))) notFound();
  return <>{children}</>;
}
