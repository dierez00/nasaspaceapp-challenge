import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><p className="eyebrow">404 · Sin acceso</p><h1>Este espacio no está disponible.</h1><p>Puede que no exista o que tu cuenta no pertenezca a esta organización.</p><Link className="button button-primary" href="/onboarding">Volver a mi espacio</Link></main>;
}
