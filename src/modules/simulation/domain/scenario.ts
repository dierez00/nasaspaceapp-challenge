import type { Experiment, Gravity } from "@/modules/atlas/domain/experiment";
export type FlameState = "ignition" | "propagation" | "extinction";
export type Conditions = {
  material: string;
  pressure: number;
  oxygen: number;
  gravity: Gravity;
  flameState: FlameState;
};
export type SimulationScenario = Conditions & {
  experimentId?: string;
  original: Conditions;
  provenance: "original" | "hypothetical";
  evidence: "demo" | "verified" | "none";
};
export type Slot = "A" | "B";
export type SimulationState = {
  scenarios: Record<Slot, SimulationScenario>;
  compare: boolean;
  activeSlot: Slot;
  cameraRevision: number;
};
export const defaultConditions: Conditions = {
  material: "PMMA",
  pressure: 8.2,
  oxygen: 32,
  gravity: "micro",
  flameState: "ignition",
};
export function fromExperiment(experiment?: Experiment): SimulationScenario {
  const values: Conditions = experiment
    ? {
        material: experiment.material,
        pressure: experiment.pressure,
        oxygen: experiment.oxygen,
        gravity: experiment.gravity,
        flameState:
          experiment.outcome === "extinction" ? "extinction" : "ignition",
      }
    : { ...defaultConditions };
  return {
    ...values,
    original: { ...values },
    experimentId: experiment?.id,
    provenance: experiment ? "original" : "hypothetical",
    evidence: experiment?.provenance ?? "none",
  };
}
export function createSimulationState(
  experiment?: Experiment,
): SimulationState {
  const scenario = fromExperiment(experiment);
  return {
    scenarios: {
      A: scenario,
      B: { ...scenario, original: { ...scenario.original } },
    },
    compare: false,
    activeSlot: "A",
    cameraRevision: 0,
  };
}
export type SimulationAction =
  | { type: "edit"; slot: Slot; patch: Partial<Conditions> }
  | { type: "compare" }
  | { type: "single" }
  | { type: "slot"; slot: Slot }
  | { type: "swap" }
  | { type: "restore"; slot: Slot }
  | { type: "camera" }
  | { type: "load"; experiments: Experiment[] };
export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case "edit": {
      const scenario = state.scenarios[action.slot];
      const next = {
        ...scenario,
        ...action.patch,
        provenance: "hypothetical" as const,
      };
      next.pressure = Math.max(
        0,
        Math.min(
          16,
          Number.isFinite(next.pressure) ? next.pressure : scenario.pressure,
        ),
      );
      next.oxygen = Math.max(
        18,
        Math.min(
          50,
          Number.isFinite(next.oxygen) ? next.oxygen : scenario.oxygen,
        ),
      );
      return {
        ...state,
        scenarios: { ...state.scenarios, [action.slot]: next },
      };
    }
    case "compare":
      return {
        ...state,
        compare: true,
        scenarios: {
          A: state.scenarios.A,
          B: {
            ...state.scenarios.A,
            original: { ...state.scenarios.A.original },
          },
        },
      };
    case "single":
      return { ...state, compare: false, activeSlot: "A" };
    case "slot":
      return { ...state, activeSlot: action.slot };
    case "swap":
      return {
        ...state,
        scenarios: { A: state.scenarios.B, B: state.scenarios.A },
      };
    case "restore":
      return {
        ...state,
        scenarios: {
          ...state.scenarios,
          [action.slot]: {
            ...state.scenarios[action.slot],
            ...state.scenarios[action.slot].original,
            provenance: state.scenarios[action.slot].experimentId
              ? "original"
              : "hypothetical",
          },
        },
      };
    case "camera":
      return { ...state, cameraRevision: state.cameraRevision + 1 };
    case "load": {
      if (!action.experiments.length) return state;
      const next = createSimulationState(action.experiments[0]);
      if (action.experiments[1]) {
        next.scenarios.B = fromExperiment(action.experiments[1]);
        next.compare = true;
      }
      return { ...next, cameraRevision: state.cameraRevision + 1 };
    }
  }
}
/** Art direction only: never a combustion or safety model. */
export function flameEnvelope(
  state: FlameState,
  seconds: number,
  pressure: number,
) {
  if (pressure <= 0) return 0;
  const t = Math.max(0, Math.min(1, seconds / 8));
  if (state === "ignition") return Math.min(1, t * 4);
  if (state === "extinction") return Math.max(0, 1 - t * 1.15);
  return 0.85 + 0.15 * Math.min(1, t * 5);
}
