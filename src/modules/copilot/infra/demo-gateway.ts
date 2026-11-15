import type { CopilotGateway } from "../application/gateway";
import type { CopilotEvent, Query, UIBlock } from "../domain/contracts";
import type { Experiment, Source } from "@/modules/atlas/domain/experiment";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import { isSolidMaterial } from "@/modules/atlas/infra/psi-api";

type Answer = { explanation: string; blocks: UIBlock[]; sources: Source[] };

/**
 * Guided copilot without agents. With the demo catalog it answers with the
 * synthetic samples; with the NASA PSI catalog it answers from those points.
 */
export class DemoCopilotGateway implements CopilotGateway {
  constructor(
    private experiments: Experiment[] = demoExperiments,
    private catalog: "demo" | "psi" = "demo",
  ) {}

  async *query(
    query: Query,
    signal?: AbortSignal,
  ): AsyncGenerator<CopilotEvent> {
    const { queryId } = query;
    for (const agent of ["analyst", "physics", "synthesizer"] as const) {
      signal?.throwIfAborted();
      yield { type: "agent-status", queryId, agent, status: "working" };
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Cancelado", "AbortError"));
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", abort);
          resolve();
        }, 220);
        signal?.addEventListener("abort", abort, { once: true });
      });
      yield { type: "agent-status", queryId, agent, status: "done" };
    }
    const { explanation, blocks, sources } =
      this.catalog === "psi" ? this.psiAnswer(query) : this.demoAnswer(query);
    yield { type: "text-delta", queryId, text: explanation };
    for (const block of blocks) {
      signal?.throwIfAborted();
      yield { type: "ui-block", queryId, block };
    }
    if (blocks.length && sources.length)
      yield {
        type: "ui-block",
        queryId,
        block: { type: "SourceList", sources },
      };
    yield { type: "done", queryId };
  }

  private demoAnswer({ text, context }: Query): Answer {
    let explanation =
      "Esta es una demostración guiada, sin agentes conectados. Explora los tres accesos rápidos para comparar muestras, gravedad y análogos. No puedo responder preguntas científicas abiertas todavía.";
    let blocks: UIBlock[] = [];
    if (context || /comparar|e-field/i.test(text)) {
      explanation = context
        ? `Sonda situada en ${context.pressure.toFixed(1)} psi y ${context.oxygen.toFixed(1)}% O₂. No hay evidencia lunar en este catálogo demostrativo. La animación no predice el resultado de una ignición.`
        : /e-field/i.test(text)
          ? "E-FIELD se presenta como tema de exploración: un campo eléctrico no equivale a gravedad lunar. Esta demo no contiene resultados verificados de ese estudio."
          : "La gravedad cambia el transporte de calor y la silueta de la llama. Estas muestras sintéticas permiten explorar la comparación, no establecer límites físicos para la Luna.";
      blocks = [
        {
          type: "GravityBounds",
          explanation:
            "1/6g: comportamiento ilustrativo, sin evidencia experimental en esta demo. No se interpolan velocidades.",
        },
      ];
      if (/comparar/i.test(text))
        blocks.push({
          type: "CompareTable",
          experimentIds: ["DEMO-001", "DEMO-004"],
        });
    } else if (/sólidos|solidos|30%/i.test(text)) {
      explanation =
        "Estas muestras ilustrativas superan el 30% de O₂. Selecciona una ficha para inspeccionarla en la cámara.";
      blocks = this.experiments
        .filter((e) => e.oxygen > 30)
        .slice(0, 3)
        .map((e) => ({ type: "ExperimentCard", experimentId: e.id }));
    }
    return {
      explanation,
      blocks,
      sources: this.experiments[0]?.sources ?? [],
    };
  }

  private psiAnswer({ text, context }: Query): Answer {
    const all = this.experiments;
    const lunar = all.filter((e) => e.gravity === "lunar").length;
    const lunarNote = lunar
      ? `Hay ${lunar} pruebas en gravedad lunar en el catálogo.`
      : "Ninguna prueba del catálogo es en gravedad lunar todavía: los resultados en microgravedad acotan, no predicen, lo que pasaría a 1/6 g.";
    const cards = (picked: Experiment[]) => ({
      blocks: picked.map((e): UIBlock => ({
        type: "ExperimentCard",
        experimentId: e.id,
      })),
      sources: picked.flatMap((e) => e.sources),
    });
    const bounds: UIBlock = { type: "GravityBounds", explanation: lunarNote };

    if (context) {
      const near = all
        .filter(
          (e) =>
            Math.abs(e.pressure - context.pressure) <= 1 &&
            Math.abs(e.oxygen - context.oxygen) <= 3,
        )
        .sort(
          (a, b) =>
            Math.hypot(
              a.pressure - context.pressure,
              a.oxygen - context.oxygen,
            ) -
            Math.hypot(
              b.pressure - context.pressure,
              b.oxygen - context.oxygen,
            ),
        );
      const solids = near.filter(isSolidMaterial).length;
      const picked = cards(distinctInvestigations(near).slice(0, 3));
      return {
        explanation: `Sonda en ${context.pressure.toFixed(1)} psi y ${context.oxygen.toFixed(1)}% O₂. En el catálogo de NASA PSI hay ${near.length} pruebas a ±1 psi y ±3% O₂ de este punto, ${solids} con materiales sólidos. La animación no predice el resultado de una ignición.`,
        blocks: [bounds, ...picked.blocks],
        sources: picked.sources,
      };
    }
    if (/e-field/i.test(text)) {
      const efield = all.filter((e) => e.id.startsWith("PSI-22/"));
      const picked = cards(efield.slice(0, 2));
      return {
        explanation: `E-FIELD (PSI-22) aplica campos eléctricos a llamas de gas en microgravedad (${efield.length} pruebas en el mapa). Un campo eléctrico sustituye a la flotación en el experimento, pero no equivale a gravedad lunar.`,
        blocks: [bounds, ...picked.blocks],
        sources: picked.sources,
      };
    }
    if (/comparar/i.test(text)) {
      const earth = all.filter((e) => e.gravity === "earth").length;
      const solids = all.filter(isSolidMaterial);
      const pair = [
        solids.find((e) => e.outcome === "ignition"),
        solids.find((e) => e.outcome === "extinction"),
      ].filter((e): e is Experiment => Boolean(e));
      const blocks: UIBlock[] = [bounds];
      if (pair.length === 2)
        blocks.push({
          type: "CompareTable",
          experimentIds: pair.map((e) => e.id),
        });
      return {
        explanation: earth
          ? `El catálogo tiene ${earth} pruebas en 1 g para comparar con microgravedad.`
          : "Todas las pruebas del catálogo de NASA PSI son en microgravedad; todavía no hay referencias en 1 g ni en 1/6 g para comparar. Aquí, dos sólidos en microgravedad: uno propagó la llama y otro se autoextinguió.",
        blocks,
        sources: pair.flatMap((e) => e.sources),
      };
    }
    if (/sólidos|solidos|30%/i.test(text)) {
      const solids = all.filter(isSolidMaterial);
      const solidsOver = solids.filter((e) => e.oxygen > 30);
      const maxSolid = Math.max(...solids.map((e) => e.oxygen));
      if (solidsOver.length) {
        const picked = cards(distinctInvestigations(solidsOver).slice(0, 3));
        return {
          explanation: `${solidsOver.length} pruebas con sólidos superan el 30% de O₂ en el catálogo de NASA PSI.`,
          ...picked,
        };
      }
      const others = all
        .filter((e) => e.oxygen > 30)
        .sort((a, b) => a.pressure - b.pressure);
      const picked = cards(distinctInvestigations(others).slice(0, 3));
      return {
        explanation: `Ninguna prueba con sólidos (telas o polímeros) supera el 30% de O₂ en el catálogo de NASA PSI: la más alta llega a ${maxSolid.toFixed(1)}%. Por encima de 30% solo hay llamas de gas y gotas de combustible (${others.length} pruebas); estas son las de menor presión:`,
        ...picked,
      };
    }
    return {
      explanation:
        "Respuestas guiadas sobre el catálogo de NASA PSI, sin agentes conectados todavía. Prueba los accesos rápidos o toca un punto del mapa para consultar la evidencia cercana.",
      blocks: [],
      sources: [],
    };
  }
}

/** One point per PSI investigation, keeping the input order. */
function distinctInvestigations(experiments: Experiment[]) {
  const seen = new Set<string>();
  return experiments.filter((e) => {
    const investigation = e.id.split("/")[0];
    if (seen.has(investigation)) return false;
    seen.add(investigation);
    return true;
  });
}
