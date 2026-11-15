import { z } from "zod";
import type { CopilotEvent, Query, UIBlock } from "../domain/contracts";
import type { Experiment } from "@/modules/atlas/domain/experiment";

/**
 * Translates the FastAPI `/query` stream (events `status`, `ui`, `error`;
 * see curren_repo_context/eventos-sse.md in the backend branch) into the
 * copilot events the front renders.
 */

const MAX_QUESTION = 500;
const MAX_TABLE_ROWS = 8;
const MAX_CARDS = 3;

const componentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string() }),
  z.object({
    type: z.literal("table"),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(
      z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ),
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
]);
const uiSchema = z.object({
  summary: z.string(),
  components: z.array(z.unknown()),
});

const agentByStep = {
  clasificando: "analyst",
  consultando_datos: "analyst",
  buscando_fuentes: "physics",
  componiendo: "synthesizer",
} as const;
type Agent = (typeof agentByStep)[keyof typeof agentByStep];

/** Backend request body: the question plus the probe, if any. */
export function backendQuestion({ text, context }: Query) {
  const probe = context
    ? ` (punto del mapa: ${context.pressure.toFixed(1)} psi, ${context.oxygen.toFixed(1)}% O₂, gravedad lunar)`
    : "";
  return { q: `${text}${probe}`.slice(0, MAX_QUESTION) };
}

export function translateUi(value: unknown, catalog: Experiment[]) {
  const ui = uiSchema.parse(value);
  const texts = [ui.summary];
  const blocks: UIBlock[] = [];
  for (const raw of ui.components) {
    const parsed = componentSchema.safeParse(raw);
    if (!parsed.success) continue;
    const component = parsed.data;
    if (component.type === "text") texts.push(component.body);
    if (component.type === "table") {
      const lines = component.rows
        .slice(0, MAX_TABLE_ROWS)
        .map(
          (row) =>
            `- ${row
              .map((cell, i) => `${component.columns[i] ?? i}: ${cell ?? "—"}`)
              .join(" · ")}`,
        );
      if (component.rows.length > MAX_TABLE_ROWS)
        lines.push(`- … ${component.rows.length - MAX_TABLE_ROWS} filas más`);
      blocks.push({
        type: "FallbackCard",
        markdown: `**${component.title}**\n\n${lines.join("\n")}`,
        sources: [],
      });
    }
    if (component.type === "gap_map") {
      blocks.push({
        type: "GravityBounds",
        explanation: component.note ?? component.title,
      });
      const ids = component.experiment_ids.length
        ? component.experiment_ids
        : [...new Set(catalog.map((e) => e.id.split("/")[0]))];
      for (const id of ids.slice(0, MAX_CARDS)) {
        const point = catalog.find((e) => e.id.startsWith(`${id}/`));
        if (point)
          blocks.push({ type: "ExperimentCard", experimentId: point.id });
      }
    }
    if (component.type === "citations")
      blocks.push({
        type: "SourceList",
        sources: component.items.map((item) => ({
          document: `${item.experiment_id} · ${item.source_file}`,
          code: item.experiment_id,
          section: item.section ?? "—",
          excerpt: item.quote,
          demo: false,
        })),
      });
    if (component.type === "notice")
      blocks.push({
        type: "FallbackCard",
        markdown: `**Aviso:** ${component.message}`,
        sources: [],
      });
  }
  return { text: texts.filter(Boolean).join("\n\n"), blocks };
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
  catalog: Experiment[],
): AsyncGenerator<CopilotEvent> {
  let current: Agent | null = null;
  const finish = function* (): Generator<CopilotEvent> {
    if (current)
      yield { type: "agent-status", queryId, agent: current, status: "done" };
    current = null;
  };
  for await (const { event, data } of frames(body)) {
    if (event === "status") {
      const step = z.object({ step: z.string() }).safeParse(data);
      const agent = step.success
        ? agentByStep[step.data.step as keyof typeof agentByStep]
        : undefined;
      if (agent && agent !== current) {
        yield* finish();
        current = agent;
        yield { type: "agent-status", queryId, agent, status: "working" };
      }
    } else if (event === "ui") {
      yield* finish();
      const { text, blocks } = translateUi(data, catalog);
      yield { type: "text-delta", queryId, text };
      for (const block of blocks) yield { type: "ui-block", queryId, block };
      yield { type: "done", queryId };
      return;
    } else if (event === "error") {
      const message = z.object({ message: z.string() }).safeParse(data);
      yield {
        type: "error",
        queryId,
        message: message.success ? message.data.message : "El backend falló.",
      };
      return;
    }
  }
  yield {
    type: "error",
    queryId,
    message: "El backend cerró la respuesta antes de terminar.",
  };
}
