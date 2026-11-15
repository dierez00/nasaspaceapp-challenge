"use client";
import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import { useSimulation, usePlayback } from "../application/simulation-provider";
import {
  flameEnvelope,
  type Slot,
  type FlameState,
  type SimulationScenario,
} from "../domain/scenario";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { Flame } from "@/modules/atlas/ui/flame";
import { gravityLabels } from "@/modules/atlas/domain/experiment";
import { gravityScenarios } from "../domain/comparison";
import { ExplorationGuide } from "./exploration-guide";
import { ComparisonNotes } from "./comparison-notes";
import { GravityIndicators, PhysicsCallout } from "./gravity-indicators";
import "./laboratory.css";
const LabCanvas = dynamic(() => import("./lab-canvas"), {
  ssr: false,
  loading: () => <div className="scene-loading">Preparando cámara 3D…</div>,
});
const stateLabels: Record<FlameState, string> = {
  ignition: "Ignición",
  propagation: "Propagación",
  extinction: "Extinción",
};
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function ScenarioControls({
  slot,
  shared = false,
}: {
  slot: Slot;
  shared?: boolean;
}) {
  const { state, edit, dispatch, clock, reduced } = useSimulation();
  const { experiments } = useAtlas();
  const scenario = state.scenarios[slot];
  const materials = [
    ...new Set([
      scenario.material,
      ...experiments.map((e) => e.material),
      "PMMA",
      "Nomex",
      "Algodón",
    ]),
  ];
  return (
    <section className="scenario-controls" aria-label={`Controles ${slot}`}>
      <div className="control-row control-row-conditions">
        <div className="cluster cluster-material">
          <span className="slot-dot" aria-hidden="true">
            {slot}
          </span>
          <label className="cluster-label">
            Material
            <select
              aria-label={`Material ${slot}`}
              value={scenario.material}
              onChange={(event) => edit(slot, { material: event.target.value })}
            >
              {materials.map((material) => (
                <option key={material}>{material}</option>
              ))}
            </select>
          </label>
          <button
            className="restore-scenario"
            onClick={() => {
              dispatch({ type: "restore", slot });
              clock.restart(!reduced);
            }}
            title="Restaurar condiciones originales"
            aria-label={`Restaurar ${slot}`}
          >
            ↶ Original
          </button>
        </div>
        {(
          [
            { key: "pressure", label: "Presión", unit: "psi", min: 0, max: 16 },
            { key: "oxygen", label: "Oxígeno", unit: "% O₂", min: 18, max: 50 },
          ] as const
        ).map((control) => {
          const value = scenario[control.key];
          const fill = Math.min(
            100,
            Math.max(
              0,
              ((value - control.min) / (control.max - control.min)) * 100,
            ),
          );
          return (
            <div className="cluster condition-control" key={control.key}>
              <div className="condition-head">
                <label
                  className="cluster-label"
                  htmlFor={`${slot}-${control.key}`}
                >
                  {control.label}
                </label>
                <div className="condition-value">
                  <input
                    type="number"
                    aria-label={`${control.label} numérica ${slot}`}
                    min={control.min}
                    max={control.max}
                    step="0.1"
                    value={value}
                    onChange={(event) =>
                      edit(slot, { [control.key]: event.target.valueAsNumber })
                    }
                  />
                  <small>{control.unit}</small>
                </div>
              </div>
              <input
                id={`${slot}-${control.key}`}
                aria-label={`${control.label} ${slot}`}
                type="range"
                min={control.min}
                max={control.max}
                step="0.1"
                value={value}
                style={{ "--fill": `${fill}%` } as React.CSSProperties}
                onChange={(event) =>
                  edit(slot, { [control.key]: Number(event.target.value) })
                }
              />
            </div>
          );
        })}
      </div>
      <div className="control-row control-row-modes">
        <div className="cluster">
          <span className="cluster-label">
            {shared ? "Tres gravedades · condiciones compartidas" : "Gravedad"}
          </span>
          <div
            className="segmented"
            role="group"
            aria-label={`Gravedad ${slot}`}
          >
            {(["micro", "lunar", "earth"] as const).map((gravity) => (
              <button
                key={gravity}
                data-gravity={gravity}
                aria-label={`${gravityLabels[gravity]} ${slot}`}
                aria-pressed={shared || scenario.gravity === gravity}
                disabled={shared}
                onClick={() => edit(slot, { gravity })}
              >
                {gravityLabels[gravity]}
                <small>
                  {gravity === "micro"
                    ? "ISS"
                    : gravity === "lunar"
                      ? "Luna"
                      : "Tierra"}
                </small>
              </button>
            ))}
          </div>
        </div>
        <div className="cluster">
          <span className="cluster-label">Fase de la llama</span>
          <div
            className="segmented"
            role="group"
            aria-label={`Estado de llama ${slot}`}
          >
            {(["ignition", "propagation", "extinction"] as const).map(
              (flameState) => (
                <button
                  key={flameState}
                  aria-label={`${stateLabels[flameState]} ${slot}`}
                  aria-pressed={scenario.flameState === flameState}
                  onClick={() => edit(slot, { flameState })}
                >
                  {stateLabels[flameState]}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
function Playback() {
  const { clock, reduced } = useSimulation();
  const { time, playing } = usePlayback();
  return (
    <div className="lab-playback">
      <button
        className="play-button"
        aria-label={playing ? "Pausar simulación" : "Reproducir simulación"}
        onClick={() => (playing ? clock.pause() : clock.play())}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <button
        className="restart-button"
        aria-label="Reiniciar simulación"
        onClick={() => clock.restart(!reduced)}
      >
        ↻
      </button>
      <label className="sr-only" htmlFor="simulation-time">
        Progreso de simulación
      </label>
      <input
        id="simulation-time"
        aria-label="Progreso de simulación"
        type="range"
        min="0"
        max="8"
        step="0.01"
        value={time}
        style={{ "--fill": `${(time / 8) * 100}%` } as React.CSSProperties}
        onChange={(event) => {
          clock.pause();
          clock.seek(Number(event.target.value));
        }}
      />
      <output data-testid="simulation-time">
        {time.toFixed(1)} <span>/ 8.0 s ↻</span>
      </output>
      <span className="timeline-note">Bucle de 8 s</span>
    </div>
  );
}
function FallbackScene({
  slot,
  scenario,
}: {
  slot: string;
  scenario: SimulationScenario;
}) {
  const { time } = usePlayback();
  const intensity = flameEnvelope(scenario.flameState, time, scenario.pressure);
  return (
    <div className="svg-chamber" data-testid={`svg-scene-${slot}`}>
      <div
        className="fallback-flame"
        style={{
          opacity: intensity,
          transform: `translateX(${scenario.flameState === "propagation" ? (time / 8 - 0.5) * 100 : 0}px) scale(${0.8 + scenario.oxygen / 100})`,
        }}
      >
        <Flame gravity={scenario.gravity} />
      </div>
      <div className="fallback-specimen" />
      <span>
        {intensity === 0
          ? scenario.pressure === 0
            ? "Cámara sin gas"
            : "Muestra apagada"
          : "Vista ilustrativa SVG"}
      </span>
    </div>
  );
}
export function Laboratory() {
  const { state, dispatch, active, reduced } = useSimulation();
  const host = useRef<HTMLDivElement>(null),
    viewA = useRef<HTMLDivElement>(null),
    viewB = useRef<HTMLDivElement>(null),
    viewC = useRef<HTMLDivElement>(null);
  const threeGravities = state.threeGravities && !state.compare;
  const [mobile, setMobile] = useState(false),
    [unsupported, setUnsupported] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const media = matchMedia("(max-width: 1023px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const fail = useCallback(() => setUnsupported(true), []);
  const slots: Slot[] = state.compare ? ["A", "B"] : ["A"];
  const views = threeGravities
    ? gravityScenarios(state.scenarios.A).map((scenario, index) => ({
        slot: ["A", "B", "C"][index],
        scenario,
      }))
    : slots.map((slot) => ({ slot, scenario: state.scenarios[slot] }));
  return (
    <section
      className="laboratory dark-instrument"
      aria-label="Laboratorio de combustión"
    >
      <header className="lab-heading">
        <div>
          <h2>
            El fuego, en otra gravedad<span>.</span>
          </h2>
          <p>Cambia las condiciones y observa cómo responde la llama.</p>
        </div>
        <div className="lab-comparison-actions">
          <button
            className={`compare-toggle ${threeGravities ? "enabled" : ""}`}
            aria-pressed={threeGravities}
            onClick={() => dispatch({ type: "three", on: !threeGravities })}
          >
            Tres gravedades
          </button>
          <button
            className={`compare-toggle ${state.compare ? "enabled" : ""}`}
            aria-pressed={state.compare}
            onClick={() =>
              dispatch({ type: state.compare ? "single" : "compare" })
            }
          >
            {state.compare ? "✕ Cerrar A/B" : "⊕ Comparar A/B"}
          </button>
        </div>
      </header>
      <ExplorationGuide
        onCompare={() => dispatch({ type: "three", on: true })}
      />
      {state.compare && (
        <div className="comparison-toolbar">
          <span>
            <i /> Comparación sincronizada
          </span>
          <div
            className="scenario-tabs"
            role="group"
            aria-label="Escenario visible"
          >
            {slots.map((slot) => (
              <button
                key={slot}
                aria-pressed={state.activeSlot === slot}
                onClick={() => dispatch({ type: "slot", slot })}
              >
                Escenario {slot}
              </button>
            ))}
          </div>
          <button onClick={() => dispatch({ type: "swap" })}>
            ⇄ Intercambiar A/B
          </button>
        </div>
      )}
      <div
        className={`lab-window cupola-octagon ${threeGravities ? "is-three" : ""} ${state.compare ? "is-comparing" : ""}`}
      >
        <motion.div
          className={`lab-viewport cupola-octagon ${threeGravities ? "is-three" : ""} ${state.compare ? "is-comparing" : ""}`}
          ref={host}
          data-active-slot={state.activeSlot}
          data-render-mode={unsupported ? "svg" : "3d"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {!unsupported && (
            <SceneBoundary key={attempt} onError={fail}>
              <LabCanvas
                host={host}
                viewA={viewA}
                viewB={viewB}
                viewC={viewC}
                threeGravities={threeGravities}
                mobile={mobile}
                onLoss={fail}
              />
            </SceneBoundary>
          )}
          <div className="scene-views">
            {views.map(({ slot, scenario }) => {
              return (
                <div
                  key={slot}
                  ref={slot === "A" ? viewA : slot === "B" ? viewB : viewC}
                  className={`scene-view scene-${slot} ${threeGravities && state.focusGravity === scenario.gravity ? "is-focus" : ""}`}
                  data-testid={`scene-${slot}`}
                  data-focus={
                    threeGravities && state.focusGravity === scenario.gravity
                      ? "true"
                      : undefined
                  }
                >
                  {unsupported && (
                    <FallbackScene slot={slot} scenario={scenario} />
                  )}
                  <div className="scene-label">
                    {!threeGravities && (
                      <span className="scene-letter">{slot}</span>
                    )}
                    <div>
                      <strong>
                        {threeGravities
                          ? gravityLabels[scenario.gravity]
                          : scenario.material}
                      </strong>
                      <small>
                        {scenario.experimentId
                          ? `${scenario.experimentId} · `
                          : ""}
                        {scenario.provenance === "hypothetical"
                          ? "Escenario hipotético"
                          : scenario.evidence === "demo"
                            ? "Original demo"
                            : scenario.experimentId
                              ? "Condiciones originales"
                              : "Escenario libre"}
                      </small>
                    </div>
                    {threeGravities && state.focusGravity === scenario.gravity && (
                      <span className="scene-focus-badge">Destacada</span>
                    )}
                    <span
                      className={`scene-gravity ${threeGravities ? "sr-only" : ""}`}
                    >
                      {gravityLabels[scenario.gravity]}
                    </span>
                  </div>
                  <div className="scene-side-label">
                    {scenario.gravity === "micro"
                      ? "Transporte difusivo"
                      : scenario.gravity === "lunar"
                        ? "Gravedad parcial · ilustración"
                        : "Convección ascendente"}
                  </div>
                  {scenario.pressure === 0 && (
                    <div className="vacuum-notice">
                      Cámara sin gas
                      <span>No se representa combustión en vacío.</span>
                    </div>
                  )}
                  <div className="scene-readings">
                    <span>
                      {scenario.pressure.toFixed(1)}
                      <small>psi</small>
                    </span>
                    <span>
                      {scenario.oxygen.toFixed(1)}
                      <small>% O₂</small>
                    </span>
                    <span className="scene-state">
                      <i />
                      {stateLabels[scenario.flameState]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="scene-bottom">
            <span>
              {unsupported
                ? "Vista SVG de respaldo"
                : "Arrastra para orbitar · rueda para acercar"}
            </span>
            <button
              aria-label="Restablecer cámara"
              onClick={() => dispatch({ type: "camera" })}
            >
              ⊙ Restablecer cámara
            </button>
          </div>
          {!active && <span className="sr-only">Renderizado suspendido</span>}
        </motion.div>
      </div>
      {unsupported && (
        <div className="graphics-notice" role="status">
          La cámara 3D no está disponible. Los controles siguen activos en SVG.
          <button
            onClick={() => {
              setUnsupported(false);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar 3D
          </button>
        </div>
      )}
      {threeGravities && (
        <p className="shared-conditions">
          {state.scenarios.A.material} · {state.scenarios.A.pressure.toFixed(1)}{" "}
          psi · {state.scenarios.A.oxygen.toFixed(1)} % O₂ · misma fase en las
          tres vistas
        </p>
      )}
      <Playback />
      {threeGravities && <PhysicsCallout />}
      {threeGravities && <GravityIndicators />}
      <div
        className={`lab-controls ${state.compare ? "is-comparing" : ""}`}
        data-active-slot={state.activeSlot}
      >
        {(threeGravities ? ["A" as const] : slots).map((slot) => (
          <ScenarioControls key={slot} slot={slot} shared={threeGravities} />
        ))}
      </div>
      <ComparisonNotes />
      <footer className="lab-disclaimer">
        <p>
          <strong>Representación cualitativa.</strong> Los controles modifican
          la apariencia; no calculan combustión ni límites de seguridad.
        </p>
      </footer>
    </section>
  );
}
