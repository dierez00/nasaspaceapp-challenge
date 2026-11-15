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
import { motion, useReducedMotion } from "motion/react";

function AtlasLayout({ mode }: { mode: "demo" | "remote" }) {
  const { state, dispatch } = useAtlas();
  const reduced = useReducedMotion();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <main
      className={`atlas-app ${theme === "dark" ? "dark" : ""}`}
      data-tab={state.tab}
    >
      <nav className="atlas-topbar" aria-label="Atlas">
        <Link
          className="atlas-brand"
          href="/"
          aria-label="Atlas del fuego lunar, inicio"
        >
          <span className="brand-orbit">
            a<span>✦</span>
          </span>
          <span>
            ATLAS<span className="brand-divider">/</span>
            <small>FUEGO LUNAR</small>
          </span>
        </Link>
        <div className="mission-label">
          <span className="mission-line" /> LUNAR COMBUSTION RESEARCH
        </div>
        <div className="topbar-actions flex items-center gap-3">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
            title={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
          >
            {theme === "light" ? "🌙 Modo oscuro" : "☀️ Modo claro"}
          </button>
          <span className="demo-indicator">
            <i />
            {mode === "demo" ? "MODO DEMOSTRACIÓN" : "DATOS REMOTOS"}
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
            <span />
          </div>
          {state.view === "lab" ? (
            <Laboratory />
          ) : (
            <motion.div
              className="workspace-map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduced ? 0 : 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <AtlasMap />
            </motion.div>
          )}
        </div>
        <CopilotPanel mode={mode} />
      </div>
      <footer className="atlas-statusbar">
        <span />
        <span>FÍSICA VISUAL · NO PREDICTIVA</span>
        <span>
          18–50% O₂ <b>/</b> 0–16 psi <span className="status-cross">⊕</span>
        </span>
      </footer>
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
        if (!controller.signal.aborted) setError(error.message);
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
