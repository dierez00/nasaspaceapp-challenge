import type { CopilotGateway } from "../application/gateway";
import type { CopilotEvent, Query, UIBlock } from "../domain/contracts";
import { demoExperiments } from "@/modules/atlas/infra/experiments";

export class DemoCopilotGateway implements CopilotGateway {
  async *query(
    query: Query,
    signal?: AbortSignal,
  ): AsyncGenerator<CopilotEvent> {
    const { queryId, text, context } = query;
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
      blocks = demoExperiments
        .filter((e) => e.oxygen > 30)
        .slice(0, 3)
        .map((e) => ({ type: "ExperimentCard", experimentId: e.id }));
    }
    yield { type: "text-delta", queryId, text: explanation };
    for (const block of blocks) {
      signal?.throwIfAborted();
      yield { type: "ui-block", queryId, block };
    }
    if (blocks.length)
      yield {
        type: "ui-block",
        queryId,
        block: { type: "SourceList", sources: demoExperiments[0].sources },
      };
    yield { type: "done", queryId };
  }
}
