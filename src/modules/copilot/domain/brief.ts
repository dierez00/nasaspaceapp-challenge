import { z } from "zod";
import type { Gravity } from "@/modules/atlas/domain/experiment";
import {
  OXYGEN_DOMAIN,
  PRESSURE_DOMAIN,
  type GapRegion,
} from "@/modules/atlas/domain/overlays";

/**
 * Evidence brief: what the data shows, the evidence, the gap and what to do
 * next, plus one reading per audience. Pure helpers shared by the translator,
 * the UI and the tests; no React and no I/O.
 */

export const KPA_PER_PSI = 6.89476;

export type Cell = string | number | boolean | null;
export const cellSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const briefGravitySchema = z.enum([
  "microgravity",
  "lunar",
  "martian",
  "normal",
]);
export type BriefGravity = z.infer<typeof briefGravitySchema>;

export const audiences = ["student", "teacher", "researcher"] as const;
export type Audience = (typeof audiences)[number];
export const audienceLabels: Record<Audience, string> = {
  student: "Estudiante",
  teacher: "Docente",
  researcher: "Investigador",
};
export const audienceHeadings: Record<Audience, string> = {
  student: "Para entenderlo",
  teacher: "Para el aula",
  researcher: "Para la investigación",
};

export const briefEvidenceSchema = z
  .object({
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(cellSchema)),
    experimentIds: z.array(z.string()),
  })
  .strict();
export type BriefEvidence = z.infer<typeof briefEvidenceSchema>;

export const briefGapSchema = z
  .object({
    description: z.string(),
    pressureKpaMin: z.number().nullable(),
    pressureKpaMax: z.number().nullable(),
    o2PercentMin: z.number().nullable(),
    o2PercentMax: z.number().nullable(),
    gravity: briefGravitySchema.nullable(),
  })
  .strict();
export type BriefGap = z.infer<typeof briefGapSchema>;

export const briefStepSchema = z
  .object({
    kind: z.enum(["simulate", "propose_experiment", "explore_map"]),
    label: z.string(),
    pressureKpa: z.number().nullable(),
    o2Percent: z.number().nullable(),
    gravity: briefGravitySchema.nullable(),
    material: z.string().nullable(),
  })
  .strict();
export type BriefStep = z.infer<typeof briefStepSchema>;

export const briefLensesSchema = z
  .object({ student: z.string(), teacher: z.string(), researcher: z.string() })
  .strict();

export const evidenceBriefSchema = z
  .object({
    type: z.literal("EvidenceBrief"),
    verdict: z.string(),
    lead: z.string().nullable(),
    evidence: briefEvidenceSchema.nullable(),
    gap: briefGapSchema.nullable(),
    nextSteps: z.array(briefStepSchema).max(3),
    lenses: briefLensesSchema,
    sourceFiles: z.array(z.string()),
    analysis: z.string().nullable(),
  })
  .strict();
export type EvidenceBriefBlock = z.infer<typeof evidenceBriefSchema>;

/* ---------- Units and rounding ---------- */

export const kpaToPsi = (kpa: number) => kpa / KPA_PER_PSI;
export const psiToKpa = (psi: number) => psi * KPA_PER_PSI;

/** Rounds to `digits` decimals and drops trailing zeros ("30.0" becomes "30"). */
export function trimNumber(value: number, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Display rounding for table cells: integers as is, otherwise 2 decimals (3 below 1). */
export function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return String(value);
  return trimNumber(value, Math.abs(value) < 1 ? 3 : 2);
}

/* ---------- Column and value labels ---------- */

const baseLabels: Record<string, { name: string; unit?: string }> = {
  experiment_id: { name: "Experimento" },
  test_id: { name: "Ensayo" },
  point_type: { name: "Tipo de punto" },
  limit_type: { name: "Tipo de límite" },
  material: { name: "Material" },
  material_class: { name: "Clase de material" },
  thickness_mm: { name: "Espesor", unit: "mm" },
  o2_percent: { name: "O₂", unit: "%" },
  o2_basis: { name: "Base del O₂" },
  o2_status: { name: "Estado del O₂" },
  pressure_kpa: { name: "Presión", unit: "kPa" },
  pressure_status: { name: "Estado de la presión" },
  gravity_environment: { name: "Gravedad" },
  gravity_g: { name: "Gravedad", unit: "g" },
  flow_velocity_cm_s: { name: "Velocidad del flujo", unit: "cm/s" },
  flow_direction: { name: "Dirección del flujo" },
  outcome: { name: "Resultado" },
  burn_length_cm: { name: "Longitud quemada", unit: "cm" },
  spread_rate_mm_s: { name: "Propagación", unit: "mm/s" },
  confidence: { name: "Confianza" },
  needs_review: { name: "Requiere revisión" },
  ensayos: { name: "Ensayos" },
  experimentos: { name: "Experimentos" },
};
const metricSuffixes: Record<string, string> = {
  promedio: "promedio",
  min: "mín.",
  max: "máx.",
};

function splitMetric(key: string) {
  const match = /^(.*)_(promedio|min|max)$/.exec(key);
  return match && match[1] in baseLabels
    ? { base: match[1], suffix: metricSuffixes[match[2]] }
    : { base: key, suffix: null };
}

function sentence(text: string) {
  const spaced = text.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `o2_percent_promedio` becomes "O₂ promedio (%)". Unknown keys are made readable, never dropped. */
export function columnLabel(key: string) {
  const { base, suffix } = splitMetric(key);
  const known = baseLabels[base];
  if (!known) return sentence(key);
  return [known.name, suffix, known.unit ? `(${known.unit})` : null]
    .filter(Boolean)
    .join(" ");
}

const valueLabels: Record<string, Record<string, string>> = {
  gravity_environment: {
    microgravity: "Microgravedad",
    lunar: "Lunar",
    martian: "Marciana",
    partial: "Parcial",
    normal: "Normal (1 g)",
  },
  outcome: {
    no_ignition: "Sin ignición",
    no_sustained_burn: "Se autoextinguió",
    partial_burn: "Combustión parcial",
    complete_burn: "Combustión completa",
  },
  o2_basis: {
    ambient: "Atmósfera",
    oxidizer_stream: "Corriente de oxidante",
  },
  material_class: {
    polymer: "Polímero",
    fabric: "Tela",
    composite: "Compuesto",
    metal: "Metal",
    liquid: "Líquido",
    gas: "Gas",
    other: "Otro",
  },
  point_type: { test: "Ensayo", limit: "Límite" },
  limit_type: {
    radiative_extinction: "Extinción radiativa",
    blowoff: "Soplado",
    quenching: "Apagado por enfriamiento",
    minimum_oxygen: "O₂ mínimo",
  },
  o2_status: statusLabels(),
  pressure_status: statusLabels(),
  flow_direction: {
    concurrent: "Concurrente",
    opposed: "Opuesto",
    quiescent: "En reposo",
    mixed: "Mixto",
  },
  confidence: { high: "Alta", medium: "Media", low: "Baja" },
};
function statusLabels() {
  return { reported: "Reportado", derived: "Derivado", assumed: "Supuesto" };
}

/** Value as shown in a table. Raw values stay in the data for CSV and sorting. */
export function formatCell(key: string, value: Cell) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return formatNumber(value);
  return valueLabels[splitMetric(key).base]?.[value] ?? value;
}

export function isNumericColumn(rows: Cell[][], index: number) {
  const values = rows.map((row) => row[index]).filter((cell) => cell !== null);
  return values.length > 0 && values.every((cell) => typeof cell === "number");
}

/** Sorts with nulls last in both directions and numbers by value. */
export function sortRows(rows: Cell[][], index: number, direction: 1 | -1) {
  return [...rows].sort((a, b) => {
    const x = a[index];
    const y = b[index];
    if (x === null || x === undefined)
      return y === null || y === undefined ? 0 : 1;
    if (y === null || y === undefined) return -1;
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "es", { numeric: true });
    return order * direction;
  });
}

const compactPriority = [
  "experiment_id",
  "test_id",
  "material",
  "o2_percent",
  "pressure_kpa",
  "gravity_environment",
  "outcome",
  "spread_rate_mm_s",
];
const COMPACT_LIMIT = 7;

/** Column indexes a non-researcher reads: every column when few, the essentials when many. */
export function compactColumns(columns: string[]) {
  if (columns.length <= COMPACT_LIMIT) return columns.map((_, index) => index);
  const picked = compactPriority
    .map((key) => columns.indexOf(key))
    .filter((index) => index >= 0)
    .slice(0, COMPACT_LIMIT);
  return picked.length
    ? picked.sort((a, b) => a - b)
    : columns.slice(0, 6).map((_, index) => index);
}

/* ---------- Gap ---------- */

const gravityNames: Record<BriefGravity, string> = {
  microgravity: "microgravedad",
  lunar: "gravedad lunar",
  martian: "gravedad marciana",
  normal: "gravedad normal (1 g)",
};
export const gravityName = (gravity: BriefGravity) => gravityNames[gravity];

/** The backend mirrors an open bound as x.01 (min) or x.99 (max): "> 30" is sent as 30.01. */
function boundKind(value: number, side: "min" | "max") {
  const cents = Math.round(value * 100);
  if (side === "min" && cents % 100 === 1)
    return { value: (cents - 1) / 100, strict: true };
  if (side === "max" && cents % 100 === 99)
    return { value: (cents + 1) / 100, strict: true };
  return { value: cents / 100, strict: false };
}

/** "> 30 %", "≥ 4.4 psi", "20–40 %", "> 30 y ≤ 50 %". Null when no bound. */
export function formatRange(
  min: number | null,
  max: number | null,
  unit: string,
  digits = 1,
) {
  const lo = min === null ? null : boundKind(min, "min");
  const hi = max === null ? null : boundKind(max, "max");
  const n = (value: number) => trimNumber(value, digits);
  if (lo && hi) {
    if (!lo.strict && !hi.strict)
      return `${n(lo.value)}–${n(hi.value)} ${unit}`;
    return `${lo.strict ? ">" : "≥"} ${n(lo.value)} y ${hi.strict ? "<" : "≤"} ${n(hi.value)} ${unit}`;
  }
  if (lo) return `${lo.strict ? ">" : "≥"} ${n(lo.value)} ${unit}`;
  if (hi) return `${hi.strict ? "<" : "≤"} ${n(hi.value)} ${unit}`;
  return null;
}

export type GapFact = { label: string; value: string };

/** Human-readable bounds of a gap; pressure is shown in kPa and in psi, the map's unit. */
export function gapFacts(gap: BriefGap): GapFact[] {
  const facts: GapFact[] = [];
  const o2 = formatRange(gap.o2PercentMin, gap.o2PercentMax, "%");
  if (o2) facts.push({ label: "Oxígeno", value: o2 });
  const kpa = formatRange(gap.pressureKpaMin, gap.pressureKpaMax, "kPa");
  if (kpa) {
    const psi = formatRange(
      gap.pressureKpaMin === null ? null : kpaToPsi(gap.pressureKpaMin),
      gap.pressureKpaMax === null ? null : kpaToPsi(gap.pressureKpaMax),
      "psi",
    );
    facts.push({ label: "Presión", value: psi ? `${kpa} · ${psi}` : kpa });
  }
  if (gap.gravity)
    facts.push({
      label: "Gravedad",
      value: capitalize(gravityNames[gap.gravity]),
    });
  return facts;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const clamp = (value: number, [low, high]: readonly [number, number]) =>
  Math.min(high, Math.max(low, value));

/** Region of the map (psi, % O₂) covered by a gap; null when it has no numeric bound. */
export function gapRegion(gap: BriefGap): GapRegion | null {
  const bounds = [
    gap.pressureKpaMin,
    gap.pressureKpaMax,
    gap.o2PercentMin,
    gap.o2PercentMax,
  ];
  if (bounds.every((value) => value === null)) return null;
  const psi = (kpa: number | null, fallback: number) =>
    kpa === null ? fallback : clamp(kpaToPsi(kpa), PRESSURE_DOMAIN);
  const o2 = (value: number | null, fallback: number) =>
    value === null ? fallback : clamp(value, OXYGEN_DOMAIN);
  return {
    pressureMin: psi(gap.pressureKpaMin, PRESSURE_DOMAIN[0]),
    pressureMax: psi(gap.pressureKpaMax, PRESSURE_DOMAIN[1]),
    oxygenMin: o2(gap.o2PercentMin, OXYGEN_DOMAIN[0]),
    oxygenMax: o2(gap.o2PercentMax, OXYGEN_DOMAIN[1]),
  };
}

export function gapMapLabel(gap: BriefGap) {
  return gap.gravity ? `Hueco · ${gravityNames[gap.gravity]}` : "Hueco";
}

/** Atlas gravity of a backend gravity; Mars has no counterpart in the map or the lab. */
export function atlasGravity(gravity: BriefGravity | null): Gravity | null {
  if (gravity === "microgravity") return "micro";
  if (gravity === "lunar") return "lunar";
  if (gravity === "normal") return "earth";
  return null;
}

/* ---------- Next steps ---------- */

export type LabParams = {
  patch: {
    pressure?: number;
    oxygen?: number;
    gravity?: Gravity;
    material?: string;
  };
  /** One line describing what was applied. */
  summary: string;
  /** Anything that could not be applied as asked. */
  notes: string[];
};

const norm = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase();

/** Best-effort match of a material name against the lab's options. */
export function matchMaterial(name: string, options: string[]) {
  const wanted = norm(name);
  if (!wanted) return null;
  return (
    options.find((option) => norm(option) === wanted) ??
    options.find((option) => {
      const candidate = norm(option);
      return candidate.includes(wanted) || wanted.includes(candidate);
    }) ??
    null
  );
}

const gravityTitle: Record<Gravity, string> = {
  micro: "µg",
  lunar: "1/6 g",
  earth: "1 g",
};

/** Translates a `simulate` step into lab conditions (kPa to psi, gravity mapping, material match). */
export function labParamsFromStep(
  step: Pick<BriefStep, "pressureKpa" | "o2Percent" | "gravity" | "material">,
  materials: string[] = [],
): LabParams {
  const patch: LabParams["patch"] = {};
  const notes: string[] = [];
  const parts: string[] = [];
  if (step.pressureKpa !== null) {
    const psi = kpaToPsi(step.pressureKpa);
    const clamped = clamp(psi, PRESSURE_DOMAIN);
    patch.pressure = Number(clamped.toFixed(1));
    parts.push(`${trimNumber(clamped, 1)} psi`);
    if (clamped !== psi)
      notes.push(
        "La presión queda fuera del rango del laboratorio (0–16 psi); se ajustó al límite.",
      );
  }
  if (step.o2Percent !== null) {
    const clamped = clamp(step.o2Percent, OXYGEN_DOMAIN);
    patch.oxygen = Number(clamped.toFixed(1));
    parts.push(`${trimNumber(clamped, 1)} % O₂`);
    if (clamped !== step.o2Percent)
      notes.push(
        "El oxígeno queda fuera del rango del laboratorio (18–50 %); se ajustó al límite.",
      );
  }
  const gravity = atlasGravity(step.gravity);
  if (gravity) {
    patch.gravity = gravity;
    parts.push(gravityTitle[gravity]);
  } else if (step.gravity === "martian")
    notes.push(
      "El laboratorio no simula gravedad marciana (0.38 g); se conservó la gravedad actual.",
    );
  if (step.material) {
    const match = matchMaterial(step.material, materials);
    if (match) {
      patch.material = match;
      parts.push(match);
    } else
      notes.push(
        `El material «${step.material}» no está en el laboratorio; se conservó el actual.`,
      );
  }
  return {
    patch,
    notes,
    summary: parts.length
      ? `Laboratorio con ${parts.join(" · ")}.`
      : "Laboratorio abierto con las condiciones actuales.",
  };
}

/** One-line description of the conditions a step applies, shown under its label. */
export function stepHint(step: BriefStep, materials: string[] = []) {
  if (step.kind === "explore_map")
    return step.gravity
      ? `Mapa filtrado a ${gravityName(step.gravity)}`
      : "Abre el mapa de evidencias";
  const { summary } = labParamsFromStep(step, materials);
  return step.kind === "simulate"
    ? summary.replace(/^Laboratorio con /, "Laboratorio: ").replace(/\.$/, "")
    : "Condiciones y qué medir";
}

/* ---------- Experiment proposal ---------- */

export type Proposal = {
  title: string;
  conditions: string[];
  measure: string[];
  text: string;
};

export function experimentProposal(
  gap: BriefGap | null,
  step: BriefStep | null,
): Proposal {
  const conditions = gap
    ? gapFacts(gap).map((f) => `${f.label}: ${f.value}`)
    : [];
  if (step?.o2Percent != null && !gap?.o2PercentMin && !gap?.o2PercentMax)
    conditions.push(`Oxígeno: ${trimNumber(step.o2Percent, 1)} %`);
  if (step?.pressureKpa != null && !gap?.pressureKpaMin && !gap?.pressureKpaMax)
    conditions.push(
      `Presión: ${trimNumber(step.pressureKpa, 1)} kPa · ${trimNumber(kpaToPsi(step.pressureKpa), 1)} psi`,
    );
  if (step?.gravity && !gap?.gravity)
    conditions.push(`Gravedad: ${capitalize(gravityNames[step.gravity])}`);
  if (step?.material) conditions.push(`Material: ${step.material}`);
  const measure = [
    "Si la llama se enciende y si se sostiene o se apaga",
    "Velocidad de propagación (mm/s)",
    "Longitud quemada (cm) y forma de la llama",
  ];
  const title = gap
    ? gap.description
    : (step?.label ?? "Propuesta de experimento");
  const text = [
    "Propuesta de experimento",
    title,
    "",
    "Condiciones a probar",
    ...(conditions.length
      ? conditions.map((c) => `- ${c}`)
      : ["- Por definir"]),
    "",
    "Qué medir",
    ...measure.map((m) => `- ${m}`),
  ].join("\n");
  return { title, conditions, measure, text };
}

/* ---------- Export: CSV and citation ---------- */

function csvCell(value: Cell) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Spreadsheet formula injection: a text cell must not start as a formula.
  if (typeof value === "string" && /^[=+@\t\r]|^-(?!\d)/.test(text))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Raw columns and values, RFC 4180 quoting, CRLF rows. No BOM here: the download adds it. */
export function evidenceCsv(evidence: Pick<BriefEvidence, "columns" | "rows">) {
  return [evidence.columns, ...evidence.rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

const months = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export function longDate(date: Date) {
  return `${date.getUTCDate()} de ${months[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

/** APA-like reference: dataset, trial ids, source files and access date. */
export function citationText(
  brief: Pick<EvidenceBriefBlock, "evidence" | "sourceFiles">,
  accessed: Date,
) {
  const title = brief.evidence?.title ?? "Consulta al Atlas";
  const ids = brief.evidence?.experimentIds ?? [];
  const synthetic = ids.length > 0 && ids.every((id) => id.startsWith("DEMO-"));
  const dataset = synthetic
    ? "Atlas del fuego lunar. Catálogo de demostración (datos sintéticos)"
    : "NASA Physical Sciences Informatics (PSI)";
  return [
    `${dataset}. (s. f.). ${title}. Consultado en Atlas del fuego lunar el ${longDate(accessed)}.`,
    ids.length ? `Experimentos: ${ids.join(", ")}.` : null,
    brief.sourceFiles.length
      ? `Archivos fuente: ${brief.sourceFiles.join("; ")}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/* ---------- Lead and progress ---------- */

const words = (text: string) =>
  new Set(
    norm(text)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3),
  );

/** The summary only earns a place under the verdict when it adds something. */
export function informativeLead(summary: string, verdict: string) {
  const text = summary.trim();
  if (!text) return null;
  if (/\b(tabla|abajo|a continuaci[oó]n)\b/i.test(text) && text.length < 120)
    return null;
  const a = words(text);
  const b = words(verdict);
  if (!a.size) return null;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / a.size >= 0.5 ? null : text;
}

export type ProgressStep =
  | "cache"
  | "clasificando"
  | "consultando_datos"
  | "buscando_fuentes"
  | "componiendo";
export const progressSteps = [
  "cache",
  "clasificando",
  "consultando_datos",
  "buscando_fuentes",
  "componiendo",
] as const;

/** User-facing description of a backend step; never names an agent. */
export function progressCopy(step: ProgressStep, trialCount?: number) {
  switch (step) {
    case "cache":
      return "Recuperando una respuesta guardada";
    case "clasificando":
      return "Entendiendo la pregunta";
    case "consultando_datos":
      return trialCount
        ? `Consultando ${trialCount} ensayos`
        : "Consultando los ensayos";
    case "buscando_fuentes":
      return "Leyendo los informes de NASA PSI";
    case "componiendo":
      return "Redactando la ficha";
  }
}
