import { z } from "zod";
import type { CopilotEvent, Query, UIBlock } from "../domain/contracts";
import {
  informativeLead,
  progressSteps,
  type ProgressStep,
} from "../domain/brief";

/**
 * Translates the FastAPI `/query` stream (events `status`, `ui`, `error`;
 * see curren_repo_context/eventos-sse.md in the backend branch) into the
 * copilot events the front renders.
 */

const MAX_QUESTION = 500;
const MAX_ROWS = 200;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const briefGravity = z.enum(["microgravity", "lunar", "martian", "normal"]);
const briefComponent = z.object({
  type: z.literal("brief"),
  verdict: z.string().min(1),
  evidence: z
    .object({
      title: z.string(),
      columns: z.array(z.string()),
      rows: z.array(z.array(cell)),
      experiment_ids: z.array(z.string()),
    })
    .nullable(),
  gap: z
    .object({
      description: z.string(),
      pressure_kpa_min: z.number().nullable(),
      pressure_kpa_max: z.number().nullable(),
      o2_percent_min: z.number().nullable(),
      o2_percent_max: z.number().nullable(),
      gravity: briefGravity.nullable(),
    })
    .nullable(),
  next_steps: z
    .array(
      z.object({
        kind: z.enum(["simulate", "propose_experiment", "explore_map"]),
        label: z.string(),
        pressure_kpa: z.number().nullable(),
        o2_percent: z.number().nullable(),
        gravity: briefGravity.nullable(),
        material: z.string().nullable(),
      }),
    )
    .max(3),
  lenses: z.object({
    student: z.string(),
    teacher: z.string(),
    researcher: z.string(),
  }),
});
const componentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string() }),
  z.object({
    type: z.literal("table"),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(cell)),
  }),
  z.object({
    type: z.literal("gap_map"),
    title: z.string(),
    experiment_ids: z.array(z.string()),
    gravity_environment: z.string().nullable(),
    note: z.string().nullable(),
  }),
  z.object({
    type: z.literal("citations"),
    items: z.array(
      z.object({
        experiment_id: z.string(),
        source_file: z.string(),
        section: z.string().nullable(),
        quote: z.string(),
      }),
    ),
  }),
  z.object({
    type: z.literal("notice"),
    level: z.string(),
    message: z.string(),
  }),
  briefComponent,
]);
const uiSchema = z.object({
  summary: z.string(),
  components: z.array(z.unknown()),
});

const knownSteps = new Set<string>(progressSteps);

/** Backend request body: the question plus the probe, if any, and the answer language. */
export function backendQuestion({ text, context, locale }: Query) {
  const lang = locale ?? "en";
  const conditions = context
    ? `${context.pressure.toFixed(1)} psi, ${context.oxygen.toFixed(1)}% O₂`
    : "";
  const probe = !context
    ? ""
    : lang === "en"
      ? ` (map point: ${conditions}, lunar gravity)`
      : ` (punto del mapa: ${conditions}, gravedad lunar)`;
  return { q: `${text}${probe}`.slice(0, MAX_QUESTION), lang };
}

type Brief = z.infer<typeof briefComponent>;
type Table = Extract<z.infer<typeof componentSchema>, { type: "table" }>;

function toBriefBlock(
  brief: Brief,
  summary: string,
  analysis: string[],
  sourceFiles: string[],
): UIBlock {
  const { evidence, gap } = brief;
  return {
    type: "EvidenceBrief",
    verdict: brief.verdict,
    lead: informativeLead(summary, brief.verdict),
    evidence: evidence && {
      title: evidence.title,
      columns: evidence.columns,
      rows: evidence.rows.slice(0, MAX_ROWS),
      experimentIds: evidence.experiment_ids,
    },
    gap: gap && {
      description: gap.description,
      pressureKpaMin: gap.pressure_kpa_min,
      pressureKpaMax: gap.pressure_kpa_max,
      o2PercentMin: gap.o2_percent_min,
      o2PercentMax: gap.o2_percent_max,
      gravity: gap.gravity,
    },
    nextSteps: brief.next_steps.map((step) => ({
      kind: step.kind,
      label: step.label,
      pressureKpa: step.pressure_kpa,
      o2Percent: step.o2_percent,
      gravity: step.gravity,
      material: step.material,
    })),
    lenses: brief.lenses,
    sourceFiles,
    analysis: analysis.length ? analysis.join("\n\n") : null,
  };
}

const sameTable = (table: Table, brief: Brief) =>
  JSON.stringify([table.columns, table.rows]) ===
  JSON.stringify([brief.evidence?.columns, brief.evidence?.rows]);

/**
 * Backend `ui` payload to front blocks. A `brief` component becomes the
 * evidence brief (verdict, evidence, gap, steps, lenses); the rest keep their
 * own shape: real tables, notices, sources. Unknown components are ignored.
 */
export function translateUi(value: unknown) {
  const ui = uiSchema.parse(value);
  const components = ui.components.flatMap((raw) => {
    const parsed = componentSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  const brief = components.find((c) => c.type === "brief");
  const sourceFiles = [
    ...new Set(
      components.flatMap((c) =>
        c.type === "citations" ? c.items.map((item) => item.source_file) : [],
      ),
    ),
  ];
  const analysis = components.flatMap((c) =>
    c.type === "text" ? [c.body] : [],
  );
  const blocks: UIBlock[] = [];
  for (const component of components) {
    if (component.type === "brief") {
      if (component === brief)
        blocks.push(toBriefBlock(component, ui.summary, analysis, sourceFiles));
    } else if (component.type === "text") {
      if (!brief) blocks.push({ type: "Narrative", markdown: component.body });
    } else if (component.type === "table") {
      if (!(brief && sameTable(component, brief)))
        blocks.push({
          type: "DataTable",
          title: component.title,
          columns: component.columns,
          rows: component.rows.slice(0, MAX_ROWS),
        });
    } else if (component.type === "gap_map") {
      if (!brief)
        blocks.push({
          type: "MapFocus",
          title: component.title,
          experimentIds: component.experiment_ids,
          gravity:
            briefGravity.safeParse(component.gravity_environment).data ?? null,
          note: component.note,
        });
    } else if (component.type === "citations") {
      blocks.push({
        type: "SourceList",
        sources: component.items.map((item) => ({
          document: `${item.source_file}`,
          code: item.experiment_id,
          section: item.section ?? "—",
          excerpt: item.quote,
          demo: false,
        })),
      });
    } else if (component.type === "notice") {
      blocks.push({
        type: "Notice",
        level: component.level === "warning" ? "warning" : "info",
        message: component.message,
      });
    }
  }
  return { text: brief ? "" : ui.summary, blocks };
}

/** Reads `event:`/`data:` frames from a backend SSE body. */
async function* frames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        let event = "message";
        const data: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:"))
            data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length)
          yield { event, data: JSON.parse(data.join("\n")) as unknown };
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function* translateBackendStream(
  body: ReadableStream<Uint8Array>,
  queryId: string,
  locale: "en" | "es" = "en",
): AsyncGenerator<CopilotEvent> {
  const en = locale === "en";
  let last: string | null = null;
  for await (const { event, data } of frames(body)) {
    if (event === "status") {
      const step = z.object({ step: z.string() }).safeParse(data);
      if (
        step.success &&
        knownSteps.has(step.data.step) &&
        step.data.step !== last
      ) {
        last = step.data.step;
        yield {
          type: "progress",
          queryId,
          step: step.data.step as ProgressStep,
        };
      }
    } else if (event === "ui") {
      const { text, blocks } = translateUi(data);
      if (text) yield { type: "text-delta", queryId, text };
      for (const block of blocks) yield { type: "ui-block", queryId, block };
      yield { type: "done", queryId };
      return;
    } else if (event === "error") {
      const message = z.object({ message: z.string() }).safeParse(data);
      yield {
        type: "error",
        queryId,
        message: message.success
          ? message.data.message
          : en
            ? "The backend failed."
            : "El backend falló.",
      };
      return;
    }
  }
  yield {
    type: "error",
    queryId,
    message: en
      ? "The backend closed the answer before finishing."
      : "El backend cerró la respuesta antes de terminar.",
  };
}
