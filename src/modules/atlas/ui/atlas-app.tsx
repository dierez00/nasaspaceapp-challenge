"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Experiment } from "../domain/experiment";
import { HttpExperimentRepository } from "../infra/experiments";
import { AtlasProvider, useAtlas } from "./atlas-provider";
import { AtlasMap } from "./atlas-map";
import { CopilotPanel } from "@/modules/copilot/ui/copilot-panel";
import "./atlas.css";
import { SimulationProvider } from "@/modules/simulation/application/simulation-provider";
import { Laboratory } from "@/modules/simulation/ui/laboratory";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useExperience } from "@/shared/experience/experience-context";

function AtlasLayout({ mode }: { mode: "demo" | "remote" }) {
  const { state, dispatch } = useAtlas();
  const reduced = useReducedMotion();
  const experience = useExperience();
  return (
    <main className="atlas-app" data-tab={state.tab}>
      <nav className="atlas-topbar" aria-label="Atlas">
        <Link
          className="atlas-brand"
          href="/"
          aria-label="Atlas del fuego lunar, inicio"
          onClick={(event) => {
            // Home is the cabin: reverse the immersion instead of reloading the route.
            if (!experience) return;
            event.preventDefault();
            experience.returnToCabin();
          }}
        >
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="10" fill="#0b3d91" />
            <path
              d="M16 6c.6 4.6 5.6 6.8 5.6 11.4A5.6 5.6 0 0 1 16 23a5.6 5.6 0 0 1-5.6-5.6C10.4 14 13 12.6 13.6 9.6c.9.9 1.2 2 1.2 3.2C16 11 16.2 8.4 16 6Z"
              fill="#ff5a1f"
            />
            <path
              d="M4.5 22.5c6 3.2 17 1.6 23-4.6"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity=".9"
            />
          </svg>
          <span>Atlas del fuego lunar</span>
        </Link>
        <div
          className="workspace-tabs"
          role="tablist"
          aria-label="Vista de exploración"
        >
          <button
            role="tab"
            aria-selected={state.view === "lab"}
            onClick={() => dispatch({ type: "view", view: "lab" })}
          >
            Laboratorio
          </button>
          <button
            role="tab"
            aria-selected={state.view === "map"}
            onClick={() => dispatch({ type: "view", view: "map" })}
          >
            Mapa de evidencias
          </button>
        </div>
        <div className="topbar-end">
          {experience && (
            <button
              type="button"
              className="return-cabin"
              onClick={experience.returnToCabin}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M16 10H5m4.5-5L4.5 10l5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Volver a la cabina
            </button>
          )}
          <span
            className="demo-indicator"
            title={
              mode === "demo"
                ? "Los ensayos y respuestas son datos de demostración"
                : "Ensayos cargados desde el catálogo remoto"
            }
          >
            <i />
            {mode === "demo" ? "Modo demostración" : "Datos remotos"}
          </span>
        </div>
      </nav>
      <div className="mobile-tabs" role="group" aria-label="Panel visible">
        <button
          aria-pressed={state.tab === "camera"}
          onClick={() => dispatch({ type: "tab", tab: "camera" })}
        >
          ⊕ Cámara
        </button>
        <button
          aria-pressed={state.tab === "copilot"}
          onClick={() => dispatch({ type: "tab", tab: "copilot" })}
        >
          ✳ Copiloto
        </button>
      </div>
      <div className="atlas-split">
        <div className="simulation-workspace">
          {/* Camera-like move between views: the incoming screen slides in from the
              side it lives on. Only transform/opacity; reduced motion just fades. */}
          <AnimatePresence initial={false}>
            <motion.div
              key={state.view}
              className="workspace-view"
              initial={
                reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x: state.view === "map" ? 40 : -40,
                      scale: 0.985,
                    }
              }
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{
                duration: reduced ? 0.12 : 0.42,
                ease: [0.45, 0, 0.15, 1],
              }}
            >
              {state.view === "lab" ? (
                <Laboratory />
              ) : (
                <div className="workspace-map">
                  <AtlasMap />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <CopilotPanel mode={mode} />
      </div>
    </main>
  );
}
export function AtlasApp({
  initialExperiments,
  mode,
}: {
  initialExperiments: Experiment[];
  mode: "demo" | "remote";
}) {
  const [experiments, setExperiments] = useState(initialExperiments);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(mode === "remote");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (mode !== "remote") return;
    const controller = new AbortController();
    new HttpExperimentRepository()
      .list(controller.signal)
      .then(setExperiments)
      .catch((error) => {
        if (controller.signal.aborted) return;
        setError(
          error instanceof TypeError
            ? "Sin conexión con el catálogo remoto. Revisa tu red."
            : error instanceof Error
              ? error.message
              : "No fue posible cargar los experimentos.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [mode, attempt]);
  return (
    <AtlasProvider experiments={experiments}>
      <SimulationProvider initialExperiment={initialExperiments[0]}>
        <AtlasLayout mode={mode} />
      </SimulationProvider>
      {loading && (
        <div className="atlas-load-notice" role="status">
          Cargando catálogo remoto…
        </div>
      )}
      {error && (
        <div className="atlas-load-notice" role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
    </AtlasProvider>
  );
}
