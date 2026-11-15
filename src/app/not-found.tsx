import Link from "next/link";

export default function NotFound() {
  return (
    <main className="theme-cabin grid min-h-screen place-items-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <p className="label">404 · Fuera de órbita</p>
        <h1 className="font-display text-3xl">Esta página no existe.</h1>
        <p className="text-moon-dust/80">La ruta que buscas no forma parte del Atlas.</p>
        <Link
          className="rounded-full bg-flame-orange px-5 py-2 font-semibold text-instrument-white"
          href="/"
        >
          Volver al Atlas
        </Link>
      </div>
    </main>
  );
}
