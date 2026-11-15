import { z } from "zod";

export const gravitySchema = z.enum(["micro", "lunar", "earth"]);
export type Gravity = z.infer<typeof gravitySchema>;
export const gravityLabels = { micro: "µg", lunar: "1/6g", earth: "1g" };
export const sourceSchema = z
  .object({
    document: z.string(),
    code: z.string(),
    section: z.string(),
    excerpt: z.string(),
    demo: z.boolean(),
    url: z.url().optional(),
  })
  .strict();
export const experimentSchema = z
  .object({
    id: z.string(),
    material: z.string(),
    pressure: z.number().min(0).max(16),
    oxygen: z.number().min(18).max(50),
    gravity: gravitySchema,
    outcome: z.enum(["ignition", "extinction", "unknown"]),
    spreadRate: z.number().nonnegative().nullable(),
    provenance: z.enum(["demo", "verified"]),
    sources: z.array(sourceSchema),
  })
  .strict();
export type Experiment = z.infer<typeof experimentSchema>;
export type Source = z.infer<typeof sourceSchema>;
export function isLunarZone(pressure: number, oxygen: number) {
  return pressure >= 0 && pressure <= 10.2 && oxygen >= 30 && oxygen <= 50;
}
export type ProbeResult =
  | { ok: true; point: { pressure: number; oxygen: number } }
  | { ok: false; reason: "invalid" | "out-of-zone" };
/** Validates a manual probe coordinate: finite numbers (rounded to 2 decimals) inside the lunar zone. */
export function resolveProbe(pressure: number, oxygen: number): ProbeResult {
  if (!Number.isFinite(pressure) || !Number.isFinite(oxygen))
    return { ok: false, reason: "invalid" };
  const point = {
    pressure: Math.round(pressure * 100) / 100,
    oxygen: Math.round(oxygen * 100) / 100,
  };
  if (!isLunarZone(point.pressure, point.oxygen))
    return { ok: false, reason: "out-of-zone" };
  return { ok: true, point };
}
export function groupCoordinates(experiments: Experiment[]) {
  const groups = new Map<string, Experiment[]>();
  for (const experiment of experiments) {
    const key = `${experiment.pressure}:${experiment.oxygen}`;
    groups.set(key, [...(groups.get(key) ?? []), experiment]);
  }
  return [...groups.values()];
}
