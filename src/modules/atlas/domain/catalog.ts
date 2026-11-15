import type { Experiment, Gravity } from "./experiment";
import { evidenceCsv } from "@/modules/copilot/domain/brief";

export type CatalogFilters = {
  material: string;
  oxygenMin: number;
  oxygenMax: number;
  pressureMin: number;
  pressureMax: number;
  gravity: Gravity | "all";
};
export function filterCatalog(
  experiments: Experiment[],
  filters: CatalogFilters,
) {
  return experiments.filter(
    (trial) =>
      (!filters.material || trial.material === filters.material) &&
      (filters.gravity === "all" || trial.gravity === filters.gravity) &&
      trial.oxygen >= filters.oxygenMin &&
      trial.oxygen <= filters.oxygenMax &&
      trial.pressure >= filters.pressureMin &&
      trial.pressure <= filters.pressureMax,
  );
}
export function catalogCsv(experiments: Experiment[]) {
  return evidenceCsv({
    columns: [
      "id",
      "material",
      "pressure_psi",
      "oxygen_percent",
      "gravity",
      "outcome",
      "provenance",
      "source_codes",
      "source_documents",
    ],
    rows: experiments.map((trial) => [
      trial.id,
      trial.material,
      trial.pressure,
      trial.oxygen,
      trial.gravity,
      trial.outcome,
      trial.provenance,
      trial.sources.map((source) => source.code).join("; "),
      trial.sources.map((source) => source.document).join("; "),
    ]),
  });
}
