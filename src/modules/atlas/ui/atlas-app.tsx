"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AtlasMark } from "@/components/brand/atlas-mark";
import type { Experiment } from "../domain/experiment";
import { HttpExperimentRepository } from "../infra/experiments";
import { AtlasProvider, useAtlas } from "./atlas-provider";
import { AtlasMap } from "./atlas-map";
import { CopilotPanel } from "@/modules/copilot/ui/copilot-panel";
import "./atlas.css";
import { SimulationProvider } from "@/modules/simulation/application/simulation-provider";
import { Laboratory } from "@/modules/simulation/ui/laboratory";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { setAudience, useAudience } from "@/modules/copilot/ui/audience-store";
import { audiences, audienceLabels } from "@/modules/copilot/domain/brief";
import { useSimulation } from "@/modules/simulation/application/simulation-provider";
import "./observatory.css";
import { useExperience } from "@/shared/experience/experience-context";

function AtlasLayout({ mode }: { mode: "demo" | "remote" }) {
  const { state, dispatch } = useAtlas();
  const reduced = useReducedMotion();
  const audience = useAudience();
  const { state: simulation } = useSimulation();
  const scenario = simulation.scenarios.A;
  const experience = useExperience();
  return (
    <main
      className="atlas-app"
      data-tab={state.tab}
      data-assistant-open={state.assistantOpen}
    >
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
          <AtlasMark className="brand-mark" />
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
      <div className="workspace-context">
        <label className="workspace-lens">
          Perspectiva
          <select
            aria-label="Perspectiva de exploración"
            value={audience}
            onChange={(event) =>
              setAudience(event.target.value as typeof audience)
            }
          >
            {audiences.map((value) => (
              <option key={value} value={value}>
                {audienceLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <p>
          {state.view === "lab" ? (
            <>
              {scenario.material}{" "}
              <span>
                · {scenario.pressure.toFixed(1)} psi ·{" "}
                {scenario.oxygen.toFixed(1)} % O₂
              </span>
            </>
          ) : (
            "Selecciona un ensayo para contrastar sus condiciones y fuentes."
          )}
        </p>
        <button
          id="evidence-toggle"
          className="assistant-toggle"
          aria-controls="contextual-evidence"
          aria-expanded={state.assistantOpen}
          onClick={() =>
            dispatch({ type: "assistant", open: !state.assistantOpen })
          }
        >
          <AtlasMark monochrome /> Evidencia y asistente
        </button>
      </div>
      <div className="mobile-tabs" role="group" aria-label="Panel visible">
        <button
          aria-pressed={state.tab === "camera"}
          onClick={() => dispatch({ type: "tab", tab: "camera" })}
        >
          Instrumento
        </button>
        <button
          id="mobile-evidence-toggle"
          aria-label="Evidencia y asistente"
          aria-expanded={state.assistantOpen}
          aria-controls="contextual-evidence"
          aria-pressed={state.tab === "copilot"}
          onClick={() => dispatch({ type: "tab", tab: "copilot" })}
        >
          Evidencia y asistente
        </button>
      </div>
      <div className="atlas-split">
        <div className="simulation-workspace">
          {/* A single opacity handoff keeps fixed WebGL scissor bounds stable. */}
          <AnimatePresence initial={false}>
            <motion.div
              key={state.view}
              className="workspace-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduced ? 0.12 : 0.18,
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
