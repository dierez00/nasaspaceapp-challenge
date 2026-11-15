import type { CopilotGateway } from "../application/gateway";
import type { CopilotEvent, Query, UIBlock } from "../domain/contracts";
import type { Experiment, Source } from "@/modules/atlas/domain/experiment";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import { isSolidMaterial } from "@/modules/atlas/infra/psi-api";
import {
  brief,
  evidenceOf,
  gapOf,
  lensesFor,
  plural,
  step,
  trimNumber,
} from "./demo-brief";
import { psiToKpa } from "../domain/brief";

type Answer = {
  explanation: string;
  blocks: UIBlock[];
  sources: Source[];
  /** When present it replaces the explanation as the answer. */
  brief?: UIBlock;
};

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
    for (const step of [
      "clasificando",
      "consultando_datos",
      "componiendo",
    ] as const) {
      signal?.throwIfAborted();
      yield { type: "progress", queryId, step };
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
    }
    const answer =
      this.catalog === "psi" ? this.psiAnswer(query) : this.demoAnswer(query);
    const { explanation, blocks, sources } = answer;
    if (answer.brief) yield { type: "ui-block", queryId, block: answer.brief };
    else yield { type: "text-delta", queryId, text: explanation };
    for (const block of blocks) {
      signal?.throwIfAborted();
      yield { type: "ui-block", queryId, block };
    }
    if ((blocks.length || answer.brief) && sources.length)
      yield {
        type: "ui-block",
        queryId,
        block: { type: "SourceList", sources },
      };
    yield { type: "done", queryId };
  }

  private demoAnswer({ text, context }: Query): Answer {
    const all = this.experiments;
    const note =
      "Muestras ilustrativas del catálogo demostrativo: sirven para explorar, no para establecer límites físicos.";
    const answer = (
      verdict: string,
      b: UIBlock,
      picked: Experiment[],
    ): Answer => ({
      explanation: verdict,
      blocks: [],
      sources: picked.flatMap((e) => e.sources),
      brief: b,
    });
    if (context) {
      const verdict = `No hay evidencia en gravedad lunar para ${trimNumber(context.pressure)} psi y ${trimNumber(context.oxygen)} % O₂ en este catálogo demostrativo.`;
      const params = {
        pressureKpa: Number(psiToKpa(context.pressure).toFixed(1)),
        o2Percent: context.oxygen,
        gravity: "lunar" as const,
      };
      return answer(
        verdict,
        brief({
          verdict,
          evidence: null,
          gap: gapOf(
            "No hay ensayos en gravedad lunar con estas condiciones.",
            {
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step("simulate", "Simular este punto en el laboratorio", params),
            step(
              "propose_experiment",
              "Proponer un ensayo en este punto",
              params,
            ),
          ],
          lenses: lensesFor("a 1/6 g en este punto", note),
        }),
        [],
      );
    }
    if (/e-field/i.test(text)) {
      const verdict =
        "E-FIELD estudia cómo un campo eléctrico sustituye a la flotación; esta demo no contiene resultados verificados de ese estudio.";
      return answer(
        verdict,
        brief({
          verdict,
          evidence: null,
          gap: gapOf("Un campo eléctrico no equivale a gravedad lunar.", {
            gravity: "lunar",
          }),
          nextSteps: [step("explore_map", "Ver las muestras en el mapa")],
          lenses: lensesFor(
            "con un campo eléctrico en lugar de gravedad",
            note,
          ),
        }),
        [],
      );
    }
    if (/comparar|compara/i.test(text)) {
      const pair = [
        all.find(
          (e) =>
            e.material === "PMMA" && e.gravity === "micro" && e.oxygen === 32,
        ),
        all.find(
          (e) =>
            e.material === "PMMA" && e.gravity === "earth" && e.oxygen === 32,
        ),
      ].filter((e): e is Experiment => Boolean(e));
      const [micro, earth] = pair;
      const verdict =
        micro && earth && micro.spreadRate !== null && earth.spreadRate !== null
          ? `PMMA con 32 % de O₂ propaga la llama a ${micro.spreadRate} mm/s en µg y a ${earth.spreadRate} mm/s en 1 g: en estas muestras arde más lento sin gravedad.`
          : "El catálogo demostrativo no tiene un par comparable de µg y 1 g para el mismo material.";
      return answer(
        verdict,
        brief({
          verdict,
          evidence: pair.length
            ? evidenceOf(
                "PMMA con 32 % de O₂: microgravedad frente a 1 g",
                pair,
              )
            : null,
          gap: gapOf(
            "No hay ensayos en gravedad lunar con estas condiciones.",
            {
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step("simulate", "Simular PMMA a 1/6 g", {
              gravity: "lunar",
              o2Percent: 32,
              material: "PMMA",
            }),
            step("explore_map", "Ver la microgravedad en el mapa", {
              gravity: "microgravity",
            }),
          ],
          lenses: lensesFor("a 1/6 g, entre µg y 1 g", note),
        }),
        pair,
      );
    }
    if (/sólidos|solidos|30\s?%/i.test(text)) {
      const over = all.filter((e) => e.oxygen > 30);
      const verdict = `${plural(over.length, "muestra ilustrativa supera", "muestras ilustrativas superan")} el 30 % de O₂.`;
      return answer(
        verdict,
        brief({
          verdict,
          evidence: evidenceOf("Muestras con más de 30 % de O₂", over),
          gap: gapOf(
            "No hay ensayos en gravedad lunar con más de 30 % de O₂.",
            {
              o2PercentMin: 30.01,
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step("simulate", "Simular el caso con más O₂", {
              o2Percent: Math.max(...over.map((e) => e.oxygen)),
            }),
            step("explore_map", "Ver estas muestras en el mapa"),
          ],
          lenses: lensesFor("con mucho más oxígeno", note),
        }),
        over.slice(0, 3),
      );
    }
    return {
      explanation:
        "Esta es una demostración guiada, sin agentes conectados. Prueba una de las preguntas de ejemplo para ver cómo llega una ficha de evidencia.",
      blocks: [],
      sources: all[0]?.sources ?? [],
    };
  }

  private psiAnswer({ text, context }: Query): Answer {
    const all = this.experiments;
    const answer = (
      verdict: string,
      b: UIBlock,
      picked: Experiment[],
    ): Answer => ({
      explanation: verdict,
      blocks: [],
      sources: picked.flatMap((e) => e.sources),
      brief: b,
    });

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
      const lunarNear = near.filter((e) => e.gravity === "lunar").length;
      const where = `a 1/6 g en ${trimNumber(context.pressure)} psi y ${trimNumber(context.oxygen)} % O₂`;
      const verdict = near.length
        ? `Cerca de este punto hay ${plural(near.length, "ensayo", "ensayos")}, ${lunarNear ? `${lunarNear} en gravedad lunar` : "ninguno en gravedad lunar"}.`
        : "No hay ensayos a ±1 psi y ±3 % O₂ de este punto.";
      const params = {
        pressureKpa: Number(psiToKpa(context.pressure).toFixed(1)),
        o2Percent: context.oxygen,
        gravity: "lunar" as const,
      };
      return answer(
        verdict,
        brief({
          verdict,
          evidence: near.length
            ? evidenceOf("Ensayos a ±1 psi y ±3 % O₂ del punto", near)
            : null,
          gap: lunarNear
            ? null
            : gapOf("No hay ensayos en gravedad lunar cerca de este punto.", {
                pressureKpaMin: Number(
                  psiToKpa(Math.max(0, context.pressure - 1)).toFixed(1),
                ),
                pressureKpaMax: Number(
                  psiToKpa(context.pressure + 1).toFixed(1),
                ),
                o2PercentMin: context.oxygen - 3,
                o2PercentMax: context.oxygen + 3,
                gravity: "lunar",
              }),
          nextSteps: [
            step("simulate", "Simular este punto en el laboratorio", params),
            step(
              "propose_experiment",
              "Proponer un ensayo en este punto",
              params,
            ),
            step("explore_map", "Ver los ensayos cercanos en el mapa"),
          ],
          lenses: lensesFor(
            where,
            `Hay ${plural(near.length, "ensayo", "ensayos")} cerca, ${solids} con sólidos.`,
          ),
        }),
        distinctInvestigations(near).slice(0, 3),
      );
    }
    if (/e-field/i.test(text)) {
      const efield = all.filter((e) => e.id.startsWith("PSI-22/"));
      const verdict = `E-FIELD (PSI-22) aplica campos eléctricos a llamas de gas en microgravedad: ${plural(efield.length, "ensayo", "ensayos")} en el mapa.`;
      return answer(
        verdict,
        brief({
          verdict,
          evidence: efield.length
            ? evidenceOf("Ensayos de E-FIELD", efield)
            : null,
          gap: gapOf(
            "Un campo eléctrico sustituye a la flotación, pero no equivale a gravedad lunar: no hay ensayos de este tipo a 1/6 g.",
            { gravity: "lunar" },
          ),
          nextSteps: [step("explore_map", "Ver E-FIELD en el mapa")],
          lenses: lensesFor(
            "con un campo eléctrico en lugar de gravedad",
            "En E-FIELD el campo eléctrico mueve los gases calientes como lo haría la flotación.",
          ),
        }),
        efield.slice(0, 2),
      );
    }
    if (/comparar|compara/i.test(text)) {
      const earth = all.filter((e) => e.gravity === "earth").length;
      const solids = all.filter(isSolidMaterial);
      const pair = [
        solids.find((e) => e.outcome === "ignition"),
        solids.find((e) => e.outcome === "extinction"),
      ].filter((e): e is Experiment => Boolean(e));
      const verdict = earth
        ? `El catálogo tiene ${plural(earth, "ensayo", "ensayos")} en 1 g para comparar con microgravedad.`
        : "Todos los ensayos del catálogo son en microgravedad: todavía no hay referencia en 1 g para comparar.";
      return answer(
        verdict,
        brief({
          verdict,
          evidence: pair.length
            ? evidenceOf(
                "Dos sólidos en microgravedad: uno propagó la llama y otro se autoextinguió",
                pair,
              )
            : null,
          gap: earth
            ? null
            : gapOf(
                "No hay ensayos en gravedad normal con estas condiciones.",
                {
                  gravity: "normal",
                },
              ),
          nextSteps: [
            step("simulate", "Comparar µg y 1 g en el laboratorio", {
              gravity: "normal",
            }),
            step("explore_map", "Ver la microgravedad en el mapa", {
              gravity: "microgravity",
            }),
          ],
          lenses: lensesFor(
            "en 1 g con el mismo material",
            "Sin gravedad el aire caliente no sube, y la llama cambia de forma y de ritmo.",
          ),
        }),
        pair,
      );
    }
    if (/sólidos|solidos|30\s?%/i.test(text)) {
      const solids = all.filter(isSolidMaterial);
      const solidsOver = solids.filter((e) => e.oxygen > 30);
      const maxSolid = Math.max(...solids.map((e) => e.oxygen));
      const lenses = lensesFor(
        "con mucho más oxígeno",
        `Los sólidos del catálogo llegan a ${trimNumber(maxSolid)} % de O₂.`,
      );
      if (solidsOver.length) {
        const verdict = `${plural(solidsOver.length, "ensayo con sólidos supera", "ensayos con sólidos superan")} el 30 % de O₂ en el catálogo de NASA PSI.`;
        return answer(
          verdict,
          brief({
            verdict,
            evidence: evidenceOf("Sólidos con más de 30 % de O₂", solidsOver),
            gap: null,
            nextSteps: [
              step("simulate", "Simular el caso con más O₂", {
                o2Percent: Math.max(...solidsOver.map((e) => e.oxygen)),
              }),
              step("explore_map", "Ver estos ensayos en el mapa"),
            ],
            lenses,
          }),
          distinctInvestigations(solidsOver).slice(0, 3),
        );
      }
      const top = [...solids].sort((a, b) => b.oxygen - a.oxygen).slice(0, 8);
      const verdict = `Ningún ensayo con sólidos supera el 30 % de O₂: el más alto llega a ${trimNumber(maxSolid)} %.`;
      return answer(
        verdict,
        brief({
          verdict,
          evidence: evidenceOf("Los sólidos con más O₂ del catálogo", top),
          gap: gapOf(
            "No hay ensayos de sólidos en atmósferas enriquecidas con más de 30 % de O₂.",
            { o2PercentMin: 30.01 },
          ),
          nextSteps: [
            step("simulate", "Simular un sólido con 30 % de O₂", {
              o2Percent: 30,
            }),
            step(
              "propose_experiment",
              "Proponer un ensayo de sólidos con O₂ enriquecido",
              {
                o2Percent: 30,
              },
            ),
            step("explore_map", "Ver los sólidos en el mapa"),
          ],
          lenses,
        }),
        distinctInvestigations(top).slice(0, 3),
      );
    }
    return {
      explanation:
        "Respuestas guiadas sobre el catálogo de NASA PSI, sin agentes conectados todavía. Prueba una de las preguntas de ejemplo o toca un punto del mapa para consultar la evidencia cercana.",
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
