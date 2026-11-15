import type { Experiment, Gravity } from "@/modules/atlas/domain/experiment";
import type { Conditions } from "./scenario";
import { nearestTrials } from "./comparison";

/**
 * Qualitative, textbook-level reading of how gravity changes a flame.
 * Art direction and explanation only: not a combustion solver, and never a
 * measured value. Every number it exposes is relative and illustrative.
 */
export type FlameShape = "esférica" | "lágrima" | "alargada";
export type Transport = "difusión" | "mixto" | "flotación";

export type GravityProfile = {
  shape: FlameShape;
  transport: Transport;
  transportNote: string;
  colorCue: string;
  /** 0..1, relative between the three gravities. Not a temperature. */
  relativeBrightness: number;
};

const base: Record<Gravity, Omit<GravityProfile, "relativeBrightness">> = {
  micro: {
    shape: "esférica",
    transport: "difusión",
    transportNote: "El oxígeno llega solo por difusión, sin corrientes.",
    colorCue: "Azul tenue",
  },
  lunar: {
    shape: "lágrima",
    transport: "mixto",
    transportNote: "Flotación débil sumada a la difusión (ilustración).",
    colorCue: "Azul-amarillo",
  },
  earth: {
    shape: "alargada",
    transport: "flotación",
    transportNote: "El aire caliente sube y arrastra oxígeno fresco.",
    colorCue: "Amarillo brillante",
  },
};
const brightness: Record<Gravity, number> = { micro: 0.35, lunar: 0.65, earth: 1 };

export function gravityProfile(
  gravity: Gravity,
  conditions: Pick<Conditions, "oxygen">,
): GravityProfile {
  const oxygen = Math.max(0, Math.min(1, (conditions.oxygen - 18) / 32));
  return {
    ...base[gravity],
    relativeBrightness: Number((brightness[gravity] * (0.75 + 0.25 * oxygen)).toFixed(2)),
  };
}

export type Outlook = "se sostiene" | "se apaga" | "incierto" | "sin gas";
export type ThresholdOutlook = {
  outlook: Outlook;
  basis: "observed" | "illustrative";
  /** Observed rows backing the outlook (empty when illustrative). */
  trials: Experiment[];
  label: string;
};

/** Normalized distance within which a real trial counts as "near". */
export const NEAR_TOLERANCE = 0.12;
const AIR_PO2_PSI = (14.7 * 21) / 100;

export function oxygenPartialRatio(c: Pick<Conditions, "pressure" | "oxygen">) {
  return (c.pressure * c.oxygen) / 100 / AIR_PO2_PSI;
}

const distance = (t: Experiment, c: Conditions) =>
  Math.hypot((t.pressure - c.pressure) / 16, (t.oxygen - c.oxygen) / 32);

/**
 * Expected behavior near the threshold. Uses verified catalog trials of the
 * same material and gravity when any lies within tolerance; otherwise falls
 * back to a coarse, explicitly illustrative rule on O₂ partial pressure.
 */
export function thresholdOutlook(
  experiments: Experiment[],
  conditions: Conditions,
  gravity: Gravity,
  tolerance = NEAR_TOLERANCE,
): ThresholdOutlook {
  if (conditions.pressure <= 0)
    return { outlook: "sin gas", basis: "illustrative", trials: [], label: "Sin gas: no hay combustión" };
  const near = nearestTrials(experiments, conditions, gravity, 3).filter(
    (trial) => distance(trial, conditions) <= tolerance,
  );
  if (near.length) {
    const outcomes = new Set(near.map((trial) => trial.outcome));
    const single = outcomes.size === 1 ? [...outcomes][0] : null;
    const outlook: Outlook =
      single === "ignition" ? "se sostiene" : single === "extinction" ? "se apaga" : "incierto";
    return {
      outlook,
      basis: "observed",
      trials: near,
      label: `Ensayos cercanos: ${outlook}`,
    };
  }
  const ratio = oxygenPartialRatio(conditions);
  const outlook: Outlook = ratio >= 1 ? "se sostiene" : ratio < 0.5 ? "se apaga" : "incierto";
  return {
    outlook,
    basis: "illustrative",
    trials: [],
    label: "Sin ensayos: predicción ilustrativa",
  };
}

export type PhysicsMoment = "ignition" | "growth" | "steady" | "extinction";

export function physicsMoment(seconds: number, flameState: Conditions["flameState"]): PhysicsMoment {
  if (seconds < 2) return "ignition";
  if (seconds < 6) return "growth";
  return flameState === "extinction" ? "extinction" : "steady";
}

const callouts: Record<PhysicsMoment, { title: string; text: string }> = {
  ignition: {
    title: "Ignición",
    text: "Misma chispa, tres respuestas: en µg la llama nace como una esfera porque no hay arriba ni abajo; en 1 g el calor ya empuja el aire hacia arriba.",
  },
  growth: {
    title: "Crecimiento",
    text: "Sin flotación, el oxígeno llega solo por difusión: la llama de µg se vuelve esférica y más tenue. En la Tierra la convección la estira y la aviva; en la Luna es un punto medio ilustrativo.",
  },
  steady: {
    title: "Régimen estable",
    text: "La llama de µg es pequeña y azulada porque produce menos hollín; la terrestre es amarilla por el hollín incandescente. Es una ilustración, no una medida de temperatura.",
  },
  extinction: {
    title: "Extinción",
    text: "Sin convección ni flotación, el oxígeno se renueva de otra forma, así que el límite de extinción cambia con la gravedad. Cuánto y en qué sentido solo lo dicen los ensayos reales, no esta ilustración.",
  },
};

export function physicsCallout(seconds: number, flameState: Conditions["flameState"]) {
  const moment = physicsMoment(seconds, flameState);
  return { moment, ...callouts[moment] };
}
