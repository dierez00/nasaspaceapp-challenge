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
import { useLocale, useT, type Text } from "@/shared/i18n/locale";
import { materialName } from "@/shared/i18n/materials";
import "./laboratory.css";
function SceneLoading() {
  const t = useT();
  return (
    <div className="scene-loading">
      {t("Preparing 3D camera…", "Preparando cámara 3D…")}
    </div>
  );
}
const LabCanvas = dynamic(() => import("./lab-canvas"), {
  ssr: false,
  loading: () => <SceneLoading />,
});
const stateLabels: Record<FlameState, Text> = {
  ignition: { en: "Ignition", es: "Ignición" },
  propagation: { en: "Propagation", es: "Propagación" },
  extinction: { en: "Extinction", es: "Extinción" },
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
  const locale = useLocale();
  const t = useT();
  const scenario = state.scenarios[slot];
  const materials = [
    ...new Set([
      scenario.material,
      ...experiments.map((e) => e.material),
      "PMMA",
      "Nomex",
      "Cotton",
    ]),
  ];
  return (
    <section
      className="scenario-controls"
      aria-label={t(`Controls ${slot}`, `Controles ${slot}`)}
    >
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
                <option key={material} value={material}>
                  {materialName(material, locale)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="restore-scenario"
            onClick={() => {
              dispatch({ type: "restore", slot });
              clock.restart(!reduced);
            }}
            title={t(
              "Restore original conditions",
              "Restaurar condiciones originales",
            )}
            aria-label={t(`Restore ${slot}`, `Restaurar ${slot}`)}
          >
            ↶ Original
          </button>
        </div>
        {(
          [
            {
              key: "pressure",
              label: t("Pressure", "Presión"),
              unit: "psi",
              min: 0,
              max: 16,
            },
            {
              key: "oxygen",
              label: t("Oxygen", "Oxígeno"),
              unit: "% O₂",
              min: 18,
              max: 50,
            },
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
                    aria-label={t(
                      `${control.label} value ${slot}`,
                      `${control.label} numérica ${slot}`,
                    )}
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
            {shared
              ? t(
                  "Three gravities · shared conditions",
                  "Tres gravedades · condiciones compartidas",
                )
              : t("Gravity", "Gravedad")}
          </span>
          <div
            className="segmented"
            role="group"
            aria-label={t(`Gravity ${slot}`, `Gravedad ${slot}`)}
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
                      ? t("Moon", "Luna")
                      : t("Earth", "Tierra")}
                </small>
              </button>
            ))}
          </div>
        </div>
        <div className="cluster">
          <span className="cluster-label">
            {t("Flame phase", "Fase de la llama")}
          </span>
          <div
            className="segmented"
            role="group"
            aria-label={t(`Flame state ${slot}`, `Estado de llama ${slot}`)}
          >
            {(["ignition", "propagation", "extinction"] as const).map(
              (flameState) => (
                <button
                  key={flameState}
                  aria-label={`${stateLabels[flameState][locale]} ${slot}`}
                  aria-pressed={scenario.flameState === flameState}
                  onClick={() => edit(slot, { flameState })}
                >
                  {stateLabels[flameState][locale]}
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
  const t = useT();
  return (
    <div className="lab-playback">
      <button
        className="play-button"
        aria-label={
          playing
            ? t("Pause simulation", "Pausar simulación")
            : t("Play simulation", "Reproducir simulación")
        }
        onClick={() => (playing ? clock.pause() : clock.play())}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <button
        className="restart-button"
        aria-label={t("Restart simulation", "Reiniciar simulación")}
        onClick={() => clock.restart(!reduced)}
      >
        ↻
      </button>
      <label className="sr-only" htmlFor="simulation-time">
        {t("Simulation progress", "Progreso de simulación")}
      </label>
      <input
        id="simulation-time"
        aria-label={t("Simulation progress", "Progreso de simulación")}
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
      <span className="timeline-note">{t("8 s loop", "Bucle de 8 s")}</span>
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
  const t = useT();
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
            ? t("Chamber without gas", "Cámara sin gas")
            : t("Sample out", "Muestra apagada")
          : t("Illustrative SVG view", "Vista ilustrativa SVG")}
      </span>
    </div>
  );
}
export function Laboratory() {
  const { state, dispatch, active, reduced } = useSimulation();
  const locale = useLocale();
  const t = useT();
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
      aria-label={t("Combustion laboratory", "Laboratorio de combustión")}
    >
      <header className="lab-heading">
        <div>
          <h2>
            {t("Fire, in another gravity", "El fuego, en otra gravedad")}
            <span>.</span>
          </h2>
          <p>
            {t(
              "Change the conditions and watch how the flame responds.",
              "Cambia las condiciones y observa cómo responde la llama.",
            )}
          </p>
        </div>
        <div className="lab-comparison-actions">
          <button
            className={`compare-toggle ${threeGravities ? "enabled" : ""}`}
            aria-pressed={threeGravities}
            onClick={() => dispatch({ type: "three", on: !threeGravities })}
          >
            {t("Three gravities", "Tres gravedades")}
          </button>
          <button
            className={`compare-toggle ${state.compare ? "enabled" : ""}`}
            aria-pressed={state.compare}
            onClick={() =>
              dispatch({ type: state.compare ? "single" : "compare" })
            }
          >
            {state.compare
              ? t("✕ Close A/B", "✕ Cerrar A/B")
              : t("⊕ Compare A/B", "⊕ Comparar A/B")}
          </button>
        </div>
      </header>
      <ExplorationGuide
        onCompare={() => dispatch({ type: "three", on: true })}
      />
      {state.compare && (
        <div className="comparison-toolbar">
          <span>
            <i /> {t("Synchronized comparison", "Comparación sincronizada")}
          </span>
          <div
            className="scenario-tabs"
            role="group"
            aria-label={t("Visible scenario", "Escenario visible")}
          >
            {slots.map((slot) => (
              <button
                key={slot}
                aria-pressed={state.activeSlot === slot}
                onClick={() => dispatch({ type: "slot", slot })}
              >
                {t("Scenario", "Escenario")} {slot}
              </button>
            ))}
          </div>
          <button onClick={() => dispatch({ type: "swap" })}>
            {t("⇄ Swap A/B", "⇄ Intercambiar A/B")}
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
                          : materialName(scenario.material, locale)}
                      </strong>
                      <small>
                        {scenario.experimentId
                          ? `${scenario.experimentId} · `
                          : ""}
                        {scenario.provenance === "hypothetical"
                          ? t("Hypothetical scenario", "Escenario hipotético")
                          : scenario.evidence === "demo"
                            ? t("Demo original", "Original demo")
                            : scenario.experimentId
                              ? t(
                                  "Original conditions",
                                  "Condiciones originales",
                                )
                              : t("Free scenario", "Escenario libre")}
                      </small>
                    </div>
                    {threeGravities &&
                      state.focusGravity === scenario.gravity && (
                        <span className="scene-focus-badge">
                          {t("Highlighted", "Destacada")}
                        </span>
                      )}
                    <span
                      className={`scene-gravity ${threeGravities ? "sr-only" : ""}`}
                    >
                      {gravityLabels[scenario.gravity]}
                    </span>
                  </div>
                  <div className="scene-side-label">
                    {scenario.gravity === "micro"
                      ? t("Diffusive transport", "Transporte difusivo")
                      : scenario.gravity === "lunar"
                        ? t(
                            "Partial gravity · illustration",
                            "Gravedad parcial · ilustración",
                          )
                        : t("Rising convection", "Convección ascendente")}
                  </div>
                  {scenario.pressure === 0 && (
                    <div className="vacuum-notice">
                      {t("Chamber without gas", "Cámara sin gas")}
                      <span>
                        {t(
                          "Combustion in a vacuum is not shown.",
                          "No se representa combustión en vacío.",
                        )}
                      </span>
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
                      {stateLabels[scenario.flameState][locale]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="scene-bottom">
            <span>
              {unsupported
                ? t("Fallback SVG view", "Vista SVG de respaldo")
                : t(
                    "Drag to orbit · Ctrl/⌘ + scroll to zoom",
                    "Arrastra para orbitar · Ctrl/⌘ + rueda para acercar",
                  )}
            </span>
            <button
              aria-label={t("Reset camera", "Restablecer cámara")}
              onClick={() => dispatch({ type: "camera" })}
            >
              ⊙ {t("Reset camera", "Restablecer cámara")}
            </button>
          </div>
          {!active && (
            <span className="sr-only">
              {t("Rendering paused", "Renderizado suspendido")}
            </span>
          )}
        </motion.div>
      </div>
      {unsupported && (
        <div className="graphics-notice" role="status">
          {t(
            "The 3D camera is unavailable. The controls still work in SVG.",
            "La cámara 3D no está disponible. Los controles siguen activos en SVG.",
          )}
          <button
            onClick={() => {
              setUnsupported(false);
              setAttempt((value) => value + 1);
            }}
          >
            {t("Retry 3D", "Reintentar 3D")}
          </button>
        </div>
      )}
      {threeGravities && (
        <p className="shared-conditions">
          {materialName(state.scenarios.A.material, locale)} ·{" "}
          {state.scenarios.A.pressure.toFixed(1)} psi ·{" "}
          {state.scenarios.A.oxygen.toFixed(1)} % O₂ ·{" "}
          {t("same phase in all three views", "misma fase en las tres vistas")}
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
          <strong>
            {t("Qualitative representation.", "Representación cualitativa.")}
          </strong>{" "}
          {t(
            "The controls change the appearance; they do not compute combustion or safety limits.",
            "Los controles modifican la apariencia; no calculan combustión ni límites de seguridad.",
          )}
        </p>
      </footer>
    </section>
  );
}
