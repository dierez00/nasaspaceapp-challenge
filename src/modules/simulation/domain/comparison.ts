import type { Experiment, Gravity } from "@/modules/atlas/domain/experiment";
import type { Conditions, SimulationScenario } from "./scenario";

export const comparisonGravities = ["micro", "lunar", "earth"] as const;
export const gravityNames: Record<Gravity, string> = {
  micro: "Microgravedad",
  lunar: "Luna",
  earth: "Tierra",
};

/** Change only gravity; these are illustrations, never observed experiment rows. */
export function gravityScenarios(
  base: SimulationScenario,
): SimulationScenario[] {
  return comparisonGravities.map((gravity) => ({
    ...base,
    gravity,
    original: { ...base.original },
    experimentId: undefined,
    provenance: "hypothetical",
    evidence: "none",
  }));
}

/** "PMMA" matches "PMMA film (polímero)": same family, ignoring the class suffix. */
export function sameMaterial(a: string, b: string) {
  const clean = (value: string) =>
    value.replace(/\s*\([^)]*\)\s*$/, "").trim().toLocaleLowerCase();
  const [x, y] = [clean(a), clean(b)];
  return x === y || y.startsWith(`${x} `) || x.startsWith(`${y} `);
}

/** Same material family/gravity only. Distance is normalized by the UI's axis ranges,
 * not a physical similarity metric. Synthetic rows must never count as evidence. */
export function nearestTrials(
  experiments: Experiment[],
  conditions: Conditions,
  gravity: Gravity,
  limit = 2,
): Experiment[] {
  const distance = (trial: Experiment) =>
    Math.hypot(
      (trial.pressure - conditions.pressure) / 16,
      (trial.oxygen - conditions.oxygen) / 32,
    );
  return experiments
    .filter(
      (trial) =>
        trial.provenance === "verified" &&
        trial.sources.some((source) => !source.demo) &&
        trial.gravity === gravity &&
        sameMaterial(trial.material, conditions.material),
    )
    .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

export function qualitativeReading(scenario: Conditions, seconds: number) {
  if (scenario.pressure === 0) return "Sin gas · sin llama";
  if (scenario.flameState === "extinction")
    return seconds >= 8 / 1.15
      ? "Apagada en la ilustración"
      : "Se extingue · fase elegida";
  return seconds === 0 && scenario.flameState === "ignition"
    ? "Inicio de ignición · fase elegida"
    : "Llama sostenida · fase elegida";
}

export function timelineExplanation(seconds: number) {
  if (seconds < 2)
    return {
      title: "0–2 s · inicio ilustrado",
      text: "La fase elegida inicia la secuencia. Compara la forma con el mismo material, presión y oxígeno; el tiempo no procede de un ensayo.",
    };
  if (seconds < 6)
    return {
      title: "2–6 s · compara el transporte",
      text: "La vista µg representa transporte por difusión; la terrestre, ascenso por flotabilidad. La lunar ilustra gravedad parcial, no una interpolación validada entre ambas.",
    };
  return {
    title: "6–8 s · observa el límite del modelo",
    text: "La llama sigue la fase seleccionada, no una predicción de supervivencia. Contrasta con los ensayos observados; ni la forma ni el color establecen un límite de seguridad.",
  };
}
