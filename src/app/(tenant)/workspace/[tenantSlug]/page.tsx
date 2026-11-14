import { logout } from "@/app/actions/auth";
import { requireUser } from "@/server/auth/session";
import { getTenantForUser } from "@/server/tenants/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/shared/config/site";

export default async function WorkspacePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const user = await requireUser(`/workspace/${tenantSlug}`);
  const tenant = await getTenantForUser(tenantSlug, user.id);
  if (!tenant) notFound();
  const role = tenant.memberships[0]?.role ?? "member";
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><Link className="wordmark" href="/">{siteConfig.shortName}<span>/</span></Link><form action={logout}><button className="text-link" type="submit">Cerrar sesión</button></form></header>
      <section className="dashboard-main">
        <p className="eyebrow">Workspace · {role}</p>
        <h1>{tenant.name}</h1>
        <p>Tu espacio está listo. Añade aquí el primer módulo del producto sin mezclar dominio, infraestructura e interfaz.</p>
        <div className="empty-board"><span>Siguiente paso</span><h2>Convierte este espacio en tu producto.</h2><p>Empieza por un módulo pequeño, define su dominio y conecta la primera experiencia real de tus usuarios.</p></div>
      </section>
    </main>
  );
}
