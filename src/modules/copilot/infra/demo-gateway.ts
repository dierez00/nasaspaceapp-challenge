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
import type { Locale } from "@/shared/i18n/locale";

/** English or Spanish by the query's locale. English is the default. */
const pick = (locale: Locale) => (en: string, es: string) =>
  locale === "en" ? en : es;

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

  private demoAnswer({ text, context, locale = "en" }: Query): Answer {
    const all = this.experiments;
    const t = pick(locale);
    const note = t(
      "Illustrative samples from the demonstration catalog: they are for exploring, not for setting physical limits.",
      "Muestras ilustrativas del catálogo demostrativo: sirven para explorar, no para establecer límites físicos.",
    );
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
      const verdict = t(
        `There is no lunar-gravity evidence for ${trimNumber(context.pressure)} psi and ${trimNumber(context.oxygen)} % O₂ in this demonstration catalog.`,
        `No hay evidencia en gravedad lunar para ${trimNumber(context.pressure)} psi y ${trimNumber(context.oxygen)} % O₂ en este catálogo demostrativo.`,
      );
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
            t(
              "There are no lunar-gravity trials under these conditions.",
              "No hay ensayos en gravedad lunar con estas condiciones.",
            ),
            {
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step(
              "simulate",
              t(
                "Simulate this point in the lab",
                "Simular este punto en el laboratorio",
              ),
              params,
            ),
            step(
              "propose_experiment",
              t(
                "Propose a trial at this point",
                "Proponer un ensayo en este punto",
              ),
              params,
            ),
          ],
          lenses: lensesFor(
            t("at 1/6 g at this point", "a 1/6 g en este punto"),
            note,
            locale,
          ),
        }),
        [],
      );
    }
    if (/e-field/i.test(text)) {
      const verdict = t(
        "E-FIELD studies how an electric field replaces buoyancy; this demo has no verified results from that study.",
        "E-FIELD estudia cómo un campo eléctrico sustituye a la flotación; esta demo no contiene resultados verificados de ese estudio.",
      );
      return answer(
        verdict,
        brief({
          verdict,
          evidence: null,
          gap: gapOf(
            t(
              "An electric field is not equivalent to lunar gravity.",
              "Un campo eléctrico no equivale a gravedad lunar.",
            ),
            {
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step(
              "explore_map",
              t("See the samples on the map", "Ver las muestras en el mapa"),
            ),
          ],
          lenses: lensesFor(
            t(
              "with an electric field instead of gravity",
              "con un campo eléctrico en lugar de gravedad",
            ),
            note,
            locale,
          ),
        }),
        [],
      );
    }
    if (/compar(ar|a|e)\b/i.test(text)) {
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
          ? t(
              `PMMA at 32 % O₂ spreads the flame at ${micro.spreadRate} mm/s in µg and at ${earth.spreadRate} mm/s in 1 g: in these samples it burns slower without gravity.`,
              `PMMA con 32 % de O₂ propaga la llama a ${micro.spreadRate} mm/s en µg y a ${earth.spreadRate} mm/s en 1 g: en estas muestras arde más lento sin gravedad.`,
            )
          : t(
              "The demonstration catalog has no comparable µg and 1 g pair for the same material.",
              "El catálogo demostrativo no tiene un par comparable de µg y 1 g para el mismo material.",
            );
      return answer(
        verdict,
        brief({
          verdict,
          evidence: pair.length
            ? evidenceOf(
                t(
                  "PMMA at 32 % O₂: microgravity versus 1 g",
                  "PMMA con 32 % de O₂: microgravedad frente a 1 g",
                ),
                pair,
              )
            : null,
          gap: gapOf(
            t(
              "There are no lunar-gravity trials under these conditions.",
              "No hay ensayos en gravedad lunar con estas condiciones.",
            ),
            {
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step(
              "simulate",
              t("Simulate PMMA at 1/6 g", "Simular PMMA a 1/6 g"),
              {
                gravity: "lunar",
                o2Percent: 32,
                material: "PMMA",
              },
            ),
            step(
              "explore_map",
              t(
                "See microgravity on the map",
                "Ver la microgravedad en el mapa",
              ),
              {
                gravity: "microgravity",
              },
            ),
          ],
          lenses: lensesFor(
            t("at 1/6 g, between µg and 1 g", "a 1/6 g, entre µg y 1 g"),
            note,
            locale,
          ),
        }),
        pair,
      );
    }
    if (/sólidos|solidos|solids?\b|30\s?%/i.test(text)) {
      const over = all.filter((e) => e.oxygen > 30);
      const verdict = t(
        `${plural(over.length, "illustrative sample exceeds", "illustrative samples exceed")} 30 % O₂.`,
        `${plural(over.length, "muestra ilustrativa supera", "muestras ilustrativas superan")} el 30 % de O₂.`,
      );
      return answer(
        verdict,
        brief({
          verdict,
          evidence: evidenceOf(
            t("Samples above 30 % O₂", "Muestras con más de 30 % de O₂"),
            over,
          ),
          gap: gapOf(
            t(
              "There are no lunar-gravity trials above 30 % O₂.",
              "No hay ensayos en gravedad lunar con más de 30 % de O₂.",
            ),
            {
              o2PercentMin: 30.01,
              gravity: "lunar",
            },
          ),
          nextSteps: [
            step(
              "simulate",
              t("Simulate the highest-O₂ case", "Simular el caso con más O₂"),
              {
                o2Percent: Math.max(...over.map((e) => e.oxygen)),
              },
            ),
            step(
              "explore_map",
              t(
                "See these samples on the map",
                "Ver estas muestras en el mapa",
              ),
            ),
          ],
          lenses: lensesFor(
            t("with much more oxygen", "con mucho más oxígeno"),
            note,
            locale,
          ),
        }),
        over.slice(0, 3),
      );
    }
    return {
      explanation: t(
        "This is a guided demonstration with no agents connected. Try one of the sample questions to see how an evidence brief arrives.",
        "Esta es una demostración guiada, sin agentes conectados. Prueba una de las preguntas de ejemplo para ver cómo llega una ficha de evidencia.",
      ),
      blocks: [],
      sources: all[0]?.sources ?? [],
    };
  }

  private psiAnswer({ text, context, locale = "en" }: Query): Answer {
    const all = this.experiments;
    const t = pick(locale);
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
      const where = t(
        `at 1/6 g at ${trimNumber(context.pressure)} psi and ${trimNumber(context.oxygen)} % O₂`,
        `a 1/6 g en ${trimNumber(context.pressure)} psi y ${trimNumber(context.oxygen)} % O₂`,
      );
      const verdict = near.length
        ? t(
            `There ${near.length === 1 ? "is" : "are"} ${plural(near.length, "trial", "trials")} near this point, ${lunarNear ? `${lunarNear} in lunar gravity` : "none in lunar gravity"}.`,
            `Cerca de este punto hay ${plural(near.length, "ensayo", "ensayos")}, ${lunarNear ? `${lunarNear} en gravedad lunar` : "ninguno en gravedad lunar"}.`,
          )
        : t(
            "There are no trials within ±1 psi and ±3 % O₂ of this point.",
            "No hay ensayos a ±1 psi y ±3 % O₂ de este punto.",
          );
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
            ? evidenceOf(
                t(
                  "Trials within ±1 psi and ±3 % O₂ of the point",
                  "Ensayos a ±1 psi y ±3 % O₂ del punto",
                ),
                near,
              )
            : null,
          gap: lunarNear
            ? null
            : gapOf(
                t(
                  "There are no lunar-gravity trials near this point.",
                  "No hay ensayos en gravedad lunar cerca de este punto.",
                ),
                {
                  pressureKpaMin: Number(
                    psiToKpa(Math.max(0, context.pressure - 1)).toFixed(1),
                  ),
                  pressureKpaMax: Number(
                    psiToKpa(context.pressure + 1).toFixed(1),
                  ),
                  o2PercentMin: context.oxygen - 3,
                  o2PercentMax: context.oxygen + 3,
                  gravity: "lunar",
                },
              ),
          nextSteps: [
            step(
              "simulate",
              t(
                "Simulate this point in the lab",
                "Simular este punto en el laboratorio",
              ),
              params,
            ),
            step(
              "propose_experiment",
              t(
                "Propose a trial at this point",
                "Proponer un ensayo en este punto",
              ),
              params,
            ),
            step(
              "explore_map",
              t(
                "See the nearby trials on the map",
                "Ver los ensayos cercanos en el mapa",
              ),
            ),
          ],
          lenses: lensesFor(
            where,
            t(
              `There ${near.length === 1 ? "is" : "are"} ${plural(near.length, "trial", "trials")} nearby, ${solids} with solids.`,
              `Hay ${plural(near.length, "ensayo", "ensayos")} cerca, ${solids} con sólidos.`,
            ),
            locale,
          ),
        }),
        distinctInvestigations(near).slice(0, 3),
      );
    }
    if (/e-field/i.test(text)) {
      const efield = all.filter((e) => e.id.startsWith("PSI-22/"));
      const verdict = t(
        `E-FIELD (PSI-22) applies electric fields to gas flames in microgravity: ${plural(efield.length, "trial", "trials")} on the map.`,
        `E-FIELD (PSI-22) aplica campos eléctricos a llamas de gas en microgravedad: ${plural(efield.length, "ensayo", "ensayos")} en el mapa.`,
      );
      return answer(
        verdict,
        brief({
          verdict,
          evidence: efield.length
            ? evidenceOf(t("E-FIELD trials", "Ensayos de E-FIELD"), efield)
            : null,
          gap: gapOf(
            t(
              "An electric field replaces buoyancy, but it is not equivalent to lunar gravity: there are no trials of this kind at 1/6 g.",
              "Un campo eléctrico sustituye a la flotación, pero no equivale a gravedad lunar: no hay ensayos de este tipo a 1/6 g.",
            ),
            { gravity: "lunar" },
          ),
          nextSteps: [
            step(
              "explore_map",
              t("See E-FIELD on the map", "Ver E-FIELD en el mapa"),
            ),
          ],
          lenses: lensesFor(
            t(
              "with an electric field instead of gravity",
              "con un campo eléctrico en lugar de gravedad",
            ),
            t(
              "In E-FIELD the electric field moves the hot gases the way buoyancy would.",
              "En E-FIELD el campo eléctrico mueve los gases calientes como lo haría la flotación.",
            ),
            locale,
          ),
        }),
        efield.slice(0, 2),
      );
    }
    if (/compar(ar|a|e)\b/i.test(text)) {
      const earth = all.filter((e) => e.gravity === "earth").length;
      const solids = all.filter(isSolidMaterial);
      const pair = [
        solids.find((e) => e.outcome === "ignition"),
        solids.find((e) => e.outcome === "extinction"),
      ].filter((e): e is Experiment => Boolean(e));
      const verdict = earth
        ? t(
            `The catalog has ${plural(earth, "trial", "trials")} in 1 g to compare with microgravity.`,
            `El catálogo tiene ${plural(earth, "ensayo", "ensayos")} en 1 g para comparar con microgravedad.`,
          )
        : t(
            "Every trial in the catalog is in microgravity: there is no 1 g reference to compare with yet.",
            "Todos los ensayos del catálogo son en microgravedad: todavía no hay referencia en 1 g para comparar.",
          );
      return answer(
        verdict,
        brief({
          verdict,
          evidence: pair.length
            ? evidenceOf(
                t(
                  "Two solids in microgravity: one spread the flame and the other self-extinguished",
                  "Dos sólidos en microgravedad: uno propagó la llama y otro se autoextinguió",
                ),
                pair,
              )
            : null,
          gap: earth
            ? null
            : gapOf(
                t(
                  "There are no normal-gravity trials under these conditions.",
                  "No hay ensayos en gravedad normal con estas condiciones.",
                ),
                {
                  gravity: "normal",
                },
              ),
          nextSteps: [
            step(
              "simulate",
              t(
                "Compare µg and 1 g in the lab",
                "Comparar µg y 1 g en el laboratorio",
              ),
              {
                gravity: "normal",
              },
            ),
            step(
              "explore_map",
              t(
                "See microgravity on the map",
                "Ver la microgravedad en el mapa",
              ),
              {
                gravity: "microgravity",
              },
            ),
          ],
          lenses: lensesFor(
            t("in 1 g with the same material", "en 1 g con el mismo material"),
            t(
              "Without gravity hot air does not rise, and the flame changes shape and pace.",
              "Sin gravedad el aire caliente no sube, y la llama cambia de forma y de ritmo.",
            ),
            locale,
          ),
        }),
        pair,
      );
    }
    if (/sólidos|solidos|solids?\b|30\s?%/i.test(text)) {
      const solids = all.filter(isSolidMaterial);
      const solidsOver = solids.filter((e) => e.oxygen > 30);
      const maxSolid = Math.max(...solids.map((e) => e.oxygen));
      const lenses = lensesFor(
        t("with much more oxygen", "con mucho más oxígeno"),
        t(
          `The catalog's solids reach ${trimNumber(maxSolid)} % O₂.`,
          `Los sólidos del catálogo llegan a ${trimNumber(maxSolid)} % de O₂.`,
        ),
        locale,
      );
      if (solidsOver.length) {
        const verdict = t(
          `${plural(solidsOver.length, "solid-fuel trial exceeds", "solid-fuel trials exceed")} 30 % O₂ in the NASA PSI catalog.`,
          `${plural(solidsOver.length, "ensayo con sólidos supera", "ensayos con sólidos superan")} el 30 % de O₂ en el catálogo de NASA PSI.`,
        );
        return answer(
          verdict,
          brief({
            verdict,
            evidence: evidenceOf(
              t("Solids above 30 % O₂", "Sólidos con más de 30 % de O₂"),
              solidsOver,
            ),
            gap: null,
            nextSteps: [
              step(
                "simulate",
                t("Simulate the highest-O₂ case", "Simular el caso con más O₂"),
                {
                  o2Percent: Math.max(...solidsOver.map((e) => e.oxygen)),
                },
              ),
              step(
                "explore_map",
                t(
                  "See these trials on the map",
                  "Ver estos ensayos en el mapa",
                ),
              ),
            ],
            lenses,
          }),
          distinctInvestigations(solidsOver).slice(0, 3),
        );
      }
      const top = [...solids].sort((a, b) => b.oxygen - a.oxygen).slice(0, 8);
      const verdict = t(
        `No solid-fuel trial exceeds 30 % O₂: the highest reaches ${trimNumber(maxSolid)} %.`,
        `Ningún ensayo con sólidos supera el 30 % de O₂: el más alto llega a ${trimNumber(maxSolid)} %.`,
      );
      return answer(
        verdict,
        brief({
          verdict,
          evidence: evidenceOf(
            t(
              "The catalog's highest-O₂ solids",
              "Los sólidos con más O₂ del catálogo",
            ),
            top,
          ),
          gap: gapOf(
            t(
              "There are no solid-fuel trials in enriched atmospheres above 30 % O₂.",
              "No hay ensayos de sólidos en atmósferas enriquecidas con más de 30 % de O₂.",
            ),
            { o2PercentMin: 30.01 },
          ),
          nextSteps: [
            step(
              "simulate",
              t(
                "Simulate a solid at 30 % O₂",
                "Simular un sólido con 30 % de O₂",
              ),
              {
                o2Percent: 30,
              },
            ),
            step(
              "propose_experiment",
              t(
                "Propose a solid-fuel trial with enriched O₂",
                "Proponer un ensayo de sólidos con O₂ enriquecido",
              ),
              {
                o2Percent: 30,
              },
            ),
            step(
              "explore_map",
              t("See the solids on the map", "Ver los sólidos en el mapa"),
            ),
          ],
          lenses,
        }),
        distinctInvestigations(top).slice(0, 3),
      );
    }
    return {
      explanation: t(
        "Guided answers about the NASA PSI catalog, with no agents connected yet. Try one of the sample questions or tap a point on the map to query the nearby evidence.",
        "Respuestas guiadas sobre el catálogo de NASA PSI, sin agentes conectados todavía. Prueba una de las preguntas de ejemplo o toca un punto del mapa para consultar la evidencia cercana.",
      ),
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
