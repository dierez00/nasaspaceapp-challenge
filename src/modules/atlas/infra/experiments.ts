import { experimentSchema, type Experiment } from "../domain/experiment";
import type { ExperimentRepository } from "../application/repository";

const samples: [
  string,
  number,
  number,
  Experiment["gravity"],
  Experiment["outcome"],
  number | null,
][] = [
  ["PMMA", 8.2, 32, "micro", "ignition", 1.8],
  ["Algodón", 14.7, 21, "earth", "ignition", 2.4],
  ["Nomex", 14.7, 21, "earth", "extinction", 0],
  ["PMMA", 14.7, 32, "earth", "ignition", 3.2],
  ["Algodón", 11.8, 26, "micro", "ignition", 1.2],
  ["Nomex", 12.4, 36, "micro", "extinction", 0],
  ["Celulosa", 6.4, 24, "micro", "extinction", 0],
  ["Polietileno", 13.2, 44, "earth", "ignition", 4.1],
  ["PMMA", 10.8, 40, "micro", "ignition", 2.1],
  ["Nomex", 4.8, 22, "micro", "extinction", 0],
  ["Algodón", 15.2, 28, "earth", "ignition", 2.7],
  ["Celulosa", 11.5, 47, "micro", "ignition", null],
];
export const demoExperiments: Experiment[] = samples.map(
  ([material, pressure, oxygen, gravity, outcome, spreadRate], index) => ({
    id: `DEMO-${String(index + 1).padStart(3, "0")}`,
    material,
    pressure,
    oxygen,
    gravity,
    outcome,
    spreadRate,
    provenance: "demo",
    sources: [
      {
        document: "Ficha ilustrativa del Atlas",
        code: `DEMO-${index + 1}`,
        section: "Condiciones de prueba",
        excerpt:
          "Datos sintéticos para explorar la interfaz. No representan un ensayo NASA PSI ni una predicción de combustión.",
        demo: true,
      },
    ],
  }),
);
export class DemoExperimentRepository implements ExperimentRepository {
  async list() {
    return demoExperiments;
  }
}
export class HttpExperimentRepository implements ExperimentRepository {
  constructor(private url = "/api/atlas/experiments") {}
  async list(signal?: AbortSignal) {
    const response = await fetch(this.url, { signal });
    if (!response.ok)
      throw new Error("No fue posible cargar los experimentos.");
    return experimentSchema.array().parse(await response.json());
  }
}
