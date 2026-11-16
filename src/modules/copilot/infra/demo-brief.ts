import type { Experiment } from "@/modules/atlas/domain/experiment";
import {
  psiToKpa,
  trimNumber,
  type BriefEvidence,
  type BriefGap,
  type BriefStep,
  type Cell,
  type EvidenceBriefBlock,
} from "../domain/brief";
import type { Locale } from "@/shared/i18n/locale";

/**
 * Evidence briefs computed from the catalog already in the front, so the
 * demo and the guided mode show the same feature as the backend agents.
 * Every number comes from the experiments passed in.
 */

const COLUMNS = [
  "experiment_id",
  "test_id",
  "material",
  "o2_percent",
  "pressure_kpa",
  "gravity_environment",
  "outcome",
  "spread_rate_mm_s",
];
const MAX_ROWS = 50;
const environment = {
  micro: "microgravity",
  lunar: "lunar",
  earth: "normal",
} as const;
const result = {
  ignition: "partial_burn",
  extinction: "no_ignition",
  unknown: null,
} as const;

export function evidenceOf(
  title: string,
  experiments: Experiment[],
): BriefEvidence {
  const rows: Cell[][] = experiments.slice(0, MAX_ROWS).map((e) => {
    const [investigation, test] = e.id.split("/");
    return [
      investigation,
      test ?? null,
      e.material,
      e.oxygen,
      Number(psiToKpa(e.pressure).toFixed(1)),
      environment[e.gravity],
      result[e.outcome],
      e.spreadRate,
    ];
  });
  return {
    title,
    columns: COLUMNS,
    rows,
    experimentIds: [...new Set(experiments.map((e) => e.id.split("/")[0]))],
  };
}

export function step(
  kind: BriefStep["kind"],
  label: string,
  params: Partial<Omit<BriefStep, "kind" | "label">> = {},
): BriefStep {
  return {
    kind,
    label,
    pressureKpa: null,
    o2Percent: null,
    gravity: null,
    material: null,
    ...params,
  };
}

export function gapOf(
  description: string,
  params: Partial<Omit<BriefGap, "description">> = {},
): BriefGap {
  return {
    description,
    pressureKpaMin: null,
    pressureKpaMax: null,
    o2PercentMin: null,
    o2PercentMax: null,
    gravity: null,
    ...params,
  };
}

/** Default readings per audience, tied to the gravity the gap is about. */
export function lensesFor(where: string, scope: string, locale: Locale = "en") {
  if (locale === "en")
    return {
      student: `A flame depends on oxygen, pressure and gravity. ${scope} Think: what do you expect would happen ${where}?`,
      teacher: `Activity: pose a hypothesis ${where}. Change a single variable in the simulator and observe whether the flame sustains, changes shape or goes out.`,
      researcher: `${scope} Check the O₂ and pressure ranges in the table and compare them with each experiment's sources before extrapolating.`,
    };
  return {
    student: `La llama depende del oxígeno, la presión y la gravedad. ${scope} Piensa: ¿qué crees que pasaría ${where}?`,
    teacher: `Actividad: plantea una hipótesis ${where}. Cambia una sola variable en el simulador y observa si la llama se sostiene, cambia de forma o se apaga.`,
    researcher: `${scope} Revisa los rangos de O₂ y presión de la tabla y contrasta con las fuentes de cada experimento antes de extrapolar.`,
  };
}

export function brief(
  parts: Pick<
    EvidenceBriefBlock,
    "verdict" | "evidence" | "gap" | "nextSteps" | "lenses"
  >,
  sourceFiles: string[] = [],
): EvidenceBriefBlock {
  return {
    type: "EvidenceBrief",
    lead: null,
    analysis: null,
    sourceFiles,
    ...parts,
  };
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export { trimNumber };
