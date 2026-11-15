import type { Experiment } from "./experiment";

/** Map domain in the units the map uses: psi on x, % O₂ on y. */
export const PRESSURE_DOMAIN = [0, 16] as const;
export const OXYGEN_DOMAIN = [18, 50] as const;

export type GapRegion = {
  pressureMin: number;
  pressureMax: number;
  oxygenMin: number;
  oxygenMax: number;
};

/** What a brief asks the map to draw: a label always, a region only when the gap has numeric bounds. */
export type GapOverlay = { label: string; region: GapRegion | null };

export type Overlays = {
  highlight: string[];
  gap: GapOverlay | null;
  /** True after a request from the copilot until the map has moved focus to its banner. */
  focusPending: boolean;
};

export const emptyOverlays: Overlays = {
  highlight: [],
  gap: null,
  focusPending: false,
};

/** PSI investigation id of a map point (`PSI-26/FP-1` becomes `PSI-26`). */
export function investigationId(experimentId: string) {
  return experimentId.split("/")[0];
}

export function isHighlighted(
  experiment: Pick<Experiment, "id">,
  highlight: ReadonlySet<string>,
) {
  return (
    highlight.has(experiment.id) ||
    highlight.has(investigationId(experiment.id))
  );
}
