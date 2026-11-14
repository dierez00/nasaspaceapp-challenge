import Link from "next/link";
import { siteConfig } from "@/shared/config/site";

const foundation = [
  { label: "Identidad", value: "Supabase Auth", state: "listo" },
  { label: "Datos", value: "PostgreSQL + Prisma", state: "listo" },
  { label: "Aislamiento", value: "Organizaciones y roles", state: "listo" },
];

const path = [
  { label: "Personaliza", text: "Cambia el nombre, los tokens visuales y el mensaje desde puntos centrales." },
  { label: "Construye", text: "Añade módulos con límites claros entre dominio, aplicación e infraestructura." },
  { label: "Publica", text: "Valida cada cambio con pruebas, tipado estricto y un flujo automático de calidad." },
];

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="site-nav" aria-label="Navegación principal">
        <Link className="wordmark" href="/">{siteConfig.shortName}<span>/</span></Link>
        <div className="nav-actions">
          <Link className="text-link" href="/auth/login">Ingresar</Link>
          <Link className="button button-primary" href="/auth/register">Crear espacio</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Starter SaaS para equipos de producto</p>
          <h1>Tu próxima idea empieza <em>en marcha.</em></h1>
          <p className="hero-intro">Autenticación, organizaciones, permisos y datos ya conectados. Usa esta base para dedicar el primer día a tu producto, no a repetir configuración.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/auth/register">Probar el flujo completo</Link>
            <a className="button button-quiet" href="#ruta">Ver cómo empezar</a>
          </div>
        </div>

        <aside className="readiness-panel" aria-label="Estado de la base técnica">
          <div className="panel-heading">
            <p>BASE / 01</p>
            <span><i aria-hidden="true" /> sistema listo</span>
          </div>
          <div className="panel-grid" aria-hidden="true" />
          <div className="foundation-list">
            {foundation.map((item) => (
              <div className="foundation-row" key={item.label}>
                <div><span>{item.label}</span><strong>{item.value}</strong></div>
                <small>{item.state}</small>
              </div>
            ))}
          </div>
          <p className="panel-command"><span>$</span> pnpm dev <b>↵</b></p>
        </aside>
      </section>

      <section className="journey" id="ruta">
        <div className="section-heading">
          <p className="eyebrow">Ruta de arranque</p>
          <p>Tres pasos reales para convertir esta base en otro producto.</p>
        </div>
        <div className="journey-grid">
          {path.map((step, index) => (
            <article key={step.label}>
              <span>0{index + 1}</span><h2>{step.label}</h2><p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
