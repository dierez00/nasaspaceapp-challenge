import type { Experiment } from "../domain/experiment";
export interface ExperimentRepository {
  list(signal?: AbortSignal): Promise<Experiment[]>;
}
