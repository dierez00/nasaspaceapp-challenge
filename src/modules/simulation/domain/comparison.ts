import type { Experiment, Gravity } from "@/modules/atlas/domain/experiment";
import type { Conditions, SimulationScenario } from "./scenario";
import { DEFAULT_LOCALE, type Locale, type Text } from "@/shared/i18n/locale";

export const comparisonGravities = ["micro", "lunar", "earth"] as const;
export const gravityNames: Record<Gravity, Text> = {
  micro: { en: "Microgravity", es: "Microgravedad" },
  lunar: { en: "Moon", es: "Luna" },
  earth: { en: "Earth", es: "Tierra" },
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
    value
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim()
      .toLocaleLowerCase();
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

export function qualitativeReading(
  scenario: Conditions,
  seconds: number,
  locale: Locale = DEFAULT_LOCALE,
) {
  const t = (en: string, es: string) => (locale === "en" ? en : es);
  if (scenario.pressure === 0)
    return t("No gas · no flame", "Sin gas · sin llama");
  if (scenario.flameState === "extinction")
    return seconds >= 8 / 1.15
      ? t("Out in the illustration", "Apagada en la ilustración")
      : t("Going out · chosen phase", "Se extingue · fase elegida");
  return seconds === 0 && scenario.flameState === "ignition"
    ? t("Ignition starts · chosen phase", "Inicio de ignición · fase elegida")
    : t("Sustained flame · chosen phase", "Llama sostenida · fase elegida");
}

export function timelineExplanation(
  seconds: number,
  locale: Locale = DEFAULT_LOCALE,
) {
  const en = locale === "en";
  if (seconds < 2)
    return en
      ? {
          title: "0–2 s · illustrated start",
          text: "The chosen phase starts the sequence. Compare the shape at the same material, pressure and oxygen; the timing does not come from a trial.",
        }
      : {
          title: "0–2 s · inicio ilustrado",
          text: "La fase elegida inicia la secuencia. Compara la forma con el mismo material, presión y oxígeno; el tiempo no procede de un ensayo.",
        };
  if (seconds < 6)
    return en
      ? {
          title: "2–6 s · compare the transport",
          text: "The µg view shows transport by diffusion; the terrestrial one, buoyant rise. The lunar view illustrates partial gravity, not a validated interpolation between the two.",
        }
      : {
          title: "2–6 s · compara el transporte",
          text: "La vista µg representa transporte por difusión; la terrestre, ascenso por flotabilidad. La lunar ilustra gravedad parcial, no una interpolación validada entre ambas.",
        };
  return en
    ? {
        title: "6–8 s · note the model's limit",
        text: "The flame follows the selected phase, not a survival prediction. Check it against observed trials; neither shape nor color sets a safety limit.",
      }
    : {
        title: "6–8 s · observa el límite del modelo",
        text: "La llama sigue la fase seleccionada, no una predicción de supervivencia. Contrasta con los ensayos observados; ni la forma ni el color establecen un límite de seguridad.",
      };
}
