import { z } from "zod";
import {
  experimentSchema,
  type Experiment,
  type Gravity,
} from "../domain/experiment";
import type { ExperimentRepository } from "../application/repository";

/**
 * Adapter for the FastAPI backend (`GET /experiments`, contract 1.1).
 * Each backend test point becomes one map point. Points outside the map's
 * domain (0–16 psi, 18–50% O₂) are skipped, never clamped.
 */

const KPA_PER_PSI = 6.895;
const EXCERPT_LIMIT = 280;

const psiTestSchema = z.object({
  test_id: z.string(),
  material: z.string(),
  material_class: z.string(),
  o2_percent: z.number(),
  pressure_kpa: z.number(),
  gravity_environment: z.string(),
  outcome: z.string(),
  spread_rate_mm_s: z.number().nullable(),
  notes: z.string().nullable(),
  source: z.object({ file: z.string(), locator: z.string() }),
});
const psiExperimentSchema = z.object({
  id: z.string(),
  title: z.string(),
  acronym: z.string().nullable(),
  source_url: z.string(),
  tests: z.array(psiTestSchema),
});
export type PsiExperiment = z.infer<typeof psiExperimentSchema>;

const gravityByEnvironment: Record<string, Gravity | undefined> = {
  microgravity: "micro",
  lunar: "lunar",
  partial: "lunar",
  normal: "earth",
};
const outcomeByResult: Record<string, Experiment["outcome"]> = {
  no_ignition: "extinction",
  no_sustained_burn: "extinction",
  partial_burn: "ignition",
  complete_burn: "ignition",
};
export const materialClassLabels: Record<string, string> = {
  polymer: "polímero",
  fabric: "tela",
  composite: "compuesto",
  metal: "metal",
  liquid: "líquido",
  gas: "gas",
  other: "otro",
};
const SOLID_LABELS = ["polímero", "tela", "compuesto", "metal", "otro"];

export function isSolidMaterial(experiment: Experiment) {
  return SOLID_LABELS.some((label) =>
    experiment.material.endsWith(`(${label})`),
  );
}

const round = (value: number) => Math.round(value * 10) / 10;

function excerpt(notes: string | null, fallback: string) {
  const text = (notes ?? fallback).trim();
  return text.length > EXCERPT_LIMIT
    ? `${text.slice(0, EXCERPT_LIMIT - 1).trimEnd()}…`
    : text;
}

export function toAtlasExperiments(records: PsiExperiment[]) {
  const experiments: Experiment[] = [];
  let omitted = 0;
  for (const record of records) {
    const label = record.acronym ?? record.id;
    for (const test of record.tests) {
      const gravity = gravityByEnvironment[test.gravity_environment];
      const candidate = experimentSchema.safeParse({
        id: `${record.id}/${test.test_id}`,
        material: `${test.material} (${materialClassLabels[test.material_class] ?? test.material_class})`,
        pressure: round(test.pressure_kpa / KPA_PER_PSI),
        oxygen: round(test.o2_percent),
        gravity,
        outcome: outcomeByResult[test.outcome] ?? "unknown",
        spreadRate: test.spread_rate_mm_s,
        provenance: "verified",
        sources: [
          {
            document: `${record.id} · ${label} · ${test.source.file}`,
            code: `${record.id} ${test.test_id}`,
            section: test.source.locator,
            excerpt: excerpt(test.notes, record.title),
            demo: false,
            url: record.source_url,
          },
        ],
      });
      if (gravity && candidate.success) experiments.push(candidate.data);
      else omitted++;
    }
  }
  return { experiments, omitted };
}

export class PsiApiExperimentRepository implements ExperimentRepository {
  omitted = 0;
  constructor(private url: string) {}
  async list(signal?: AbortSignal) {
    const response = await fetch(this.url, { signal, cache: "no-store" });
    if (!response.ok)
      throw new Error("No fue posible cargar los experimentos de NASA PSI.");
    const records = psiExperimentSchema.array().parse(await response.json());
    const { experiments, omitted } = toAtlasExperiments(records);
    this.omitted = omitted;
    return experiments;
  }
}

export function psiApiRepository() {
  const base = process.env.ATLAS_API_URL;
  if (!base) return null;
  return new PsiApiExperimentRepository(
    `${base.replace(/\/$/, "")}/experiments`,
  );
}
