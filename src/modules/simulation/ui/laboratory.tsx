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
import { flameEnvelope, type Slot, type FlameState } from "../domain/scenario";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { Flame } from "@/modules/atlas/ui/flame";
import { gravityLabels } from "@/modules/atlas/domain/experiment";
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
function ScenarioControls({ slot }: { slot: Slot }) {
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
      <div className="scenario-control-head">
        <span className="slot-dot">{slot}</span>
        <label>
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
      <div className="scenario-sliders">
        {(
          [
            { key: "pressure", label: "Presión", unit: "psi", min: 0, max: 16 },
            { key: "oxygen", label: "Oxígeno", unit: "% O₂", min: 18, max: 50 },
          ] as const
        ).map((control) => (
          <div className="condition-control" key={control.key}>
            <div>
              <label htmlFor={`${slot}-${control.key}`}>{control.label}</label>
              <div>
                <input
                  type="number"
                  aria-label={`${control.label} numérica ${slot}`}
                  min={control.min}
                  max={control.max}
                  step="0.1"
                  value={scenario[control.key]}
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
              value={scenario[control.key]}
              onChange={(event) =>
                edit(slot, { [control.key]: Number(event.target.value) })
              }
            />
          </div>
        ))}
      </div>
      <div className="scenario-buttons">
        <div role="group" aria-label={`Gravedad ${slot}`}>
          {(["micro", "lunar", "earth"] as const).map((gravity) => (
            <button
              key={gravity}
              aria-label={`${gravityLabels[gravity]} ${slot}`}
              aria-pressed={scenario.gravity === gravity}
              onClick={() => edit(slot, { gravity })}
            >
              {gravityLabels[gravity]}
              <small>
                {gravity === "micro"
                  ? "ISS"
                  : gravity === "lunar"
                    ? "LUNA"
                    : "TIERRA"}
              </small>
            </button>
          ))}
        </div>
        <div role="group" aria-label={`Estado de llama ${slot}`}>
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
        onChange={(event) => {
          clock.pause();
          clock.seek(Number(event.target.value));
        }}
      />
      <output data-testid="simulation-time">
        {time.toFixed(1)} <span>/ 8.0 s ↻</span>
      </output>
      <span className="timeline-note">BUCLE DE 8 s</span>
    </div>
  );
}
function FallbackScene({ slot }: { slot: Slot }) {
  const { state } = useSimulation();
  const { time } = usePlayback();
  const scenario = state.scenarios[slot];
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
    viewB = useRef<HTMLDivElement>(null);
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
  return (
    <section className="laboratory" aria-label="Laboratorio de combustión">
      <header className="lab-heading">
        <div>
          <p className="micro-label">CÁMARA DE COMBUSTIÓN / LAB 01</p>
          <h1>
            El fuego, en otra gravedad<span>.</span>
          </h1>
          <p>Enciende una pregunta. Explora lo que cambia.</p>
        </div>
        <button
          className={`compare-toggle ${state.compare ? "enabled" : ""}`}
          aria-pressed={state.compare}
          onClick={() =>
            dispatch({ type: state.compare ? "single" : "compare" })
          }
        >
          {state.compare ? "✕ Cerrar A/B" : "⊕ Comparar A/B"}
        </button>
      </header>
      {state.compare && (
        <div className="comparison-toolbar">
          <span>
            COMPARACIÓN SINCRONIZADA <i />
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
      <motion.div
        className={`lab-viewport ${state.compare ? "is-comparing" : ""}`}
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
              mobile={mobile}
              onLoss={fail}
            />
          </SceneBoundary>
        )}
        <div className="scene-views">
          {slots.map((slot) => {
            const scenario = state.scenarios[slot];
            return (
              <div
                key={slot}
                ref={slot === "A" ? viewA : viewB}
                className={`scene-view scene-${slot}`}
                data-testid={`scene-${slot}`}
              >
                {unsupported && <FallbackScene slot={slot} />}
                <div className="scene-label">
                  <span className="scene-letter">{slot}</span>
                  <div>
                    <strong>{scenario.material}</strong>
                    <small>
                      {scenario.experimentId ?? "ESCENARIO LIBRE"} ·{" "}
                      {scenario.provenance === "hypothetical"
                        ? "ESCENARIO HIPOTÉTICO"
                        : scenario.evidence === "demo"
                          ? "ORIGINAL DEMO"
                          : "CONDICIONES ORIGINALES"}
                    </small>
                  </div>
                  <span className="scene-gravity">
                    {gravityLabels[scenario.gravity]}
                  </span>
                </div>
                <div className="scene-side-label">
                  {scenario.gravity === "micro"
                    ? "TRANSPORTE DIFUSIVO"
                    : scenario.gravity === "lunar"
                      ? "GRAVEDAD PARCIAL · ILUSTRACIÓN"
                      : "CONVECCIÓN ASCENDENTE"}
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
              ? "VISTA SVG DE RESPALDO"
              : "ARRASTRA PARA ORBITAR · RUEDA PARA ACERCAR"}
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
      <Playback />
      <div
        className={`lab-controls ${state.compare ? "is-comparing" : ""}`}
        data-active-slot={state.activeSlot}
      >
        {slots.map((slot) => (
          <ScenarioControls key={slot} slot={slot} />
        ))}
      </div>
      <footer className="lab-disclaimer">
        <span>◇ REPRESENTACIÓN CUALITATIVA</span>
        <p>
          Los controles modifican la apariencia. No calculan combustión ni
          límites de seguridad.
        </p>
      </footer>
    </section>
  );
}
