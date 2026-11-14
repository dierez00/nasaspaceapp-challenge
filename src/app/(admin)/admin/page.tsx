import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { siteConfig } from "@/shared/config/site";

export default function AdminPage() {
  return (
    <main className="dashboard-shell admin-shell">
      <header className="dashboard-header"><Link className="wordmark" href="/">{siteConfig.shortName}<span>/</span></Link><form action={logout}><button className="text-link" type="submit">Cerrar sesión</button></form></header>
      <section className="dashboard-main"><p className="eyebrow">Operación global</p><h1>Administración</h1><p>Acceso reservado para el equipo que opera la plataforma.</p></section>
    </main>
  );
}
