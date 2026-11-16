"use client";

import Link from "next/link";
import { useT } from "@/shared/i18n/locale";

export default function NotFound() {
  const t = useT();
  return (
    <main className="theme-cabin grid min-h-screen place-items-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <p className="label">404 · {t("Out of orbit", "Fuera de órbita")}</p>
        <h1 className="font-display text-3xl">
          {t("This page does not exist.", "Esta página no existe.")}
        </h1>
        <p className="text-moon-dust/80">
          {t(
            "The page you are looking for is not part of the Atlas.",
            "La ruta que buscas no forma parte del Atlas.",
          )}
        </p>
        <Link
          className="rounded-full bg-flame-orange px-5 py-2 font-semibold text-instrument-white"
          href="/"
        >
          {t("Back to the Atlas", "Volver al Atlas")}
        </Link>
      </div>
    </main>
  );
}
