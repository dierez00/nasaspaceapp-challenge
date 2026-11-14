import Link from "next/link";
import { siteConfig } from "@/shared/config/site";

export function AuthShell({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link className="wordmark" href="/" aria-label={`${siteConfig.name}, inicio`}>
        {siteConfig.shortName}<span>/</span>
      </Link>
      <section className="auth-card">
        <div className="auth-card-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
