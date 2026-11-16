"use client";

import { useMemo } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { useLocale, useT, type Text } from "@/shared/i18n/locale";
import { gravityLabels } from "@/modules/atlas/domain/experiment";
import { useSimulation } from "../application/simulation-provider";
import {
  comparisonGravities,
  gravityNames,
  nearestTrials,
} from "../domain/comparison";

const observedLabels: Record<"ignition" | "extinction" | "unknown", Text> = {
  ignition: { en: "Ignition recorded", es: "Ignición registrada" },
  extinction: { en: "Extinction recorded", es: "Extinción registrada" },
  unknown: { en: "Outcome undetermined", es: "Resultado no determinado" },
};

export function ComparisonNotes() {
  const { experiments, highlightExperiments, dispatch } = useAtlas();
  const { state, load } = useSimulation();
  const locale = useLocale();
  const t = useT();
  const base = state.scenarios.A;
  const nearest = useMemo(
    () =>
      comparisonGravities.map((gravity) => ({
        gravity,
        trials: nearestTrials(experiments, base, gravity, 3),
      })),
    [experiments, base],
  );
  return (
    <section
      className="comparison-notes"
      aria-label={t("Comparative reading", "Lectura comparativa")}
    >
      <details className="nearest-trials evidence-paper">
        <summary>
          {t(
            "Trials and sources · check against real data",
            "Ensayos y fuentes · contrastar con datos reales",
          )}
        </summary>
        <p>
          {t(
            "Up to three per gravity, same material; closeness by pressure / 16 psi and O₂ / 32 percentage points. It implies no physical equivalence and does not predict this scenario.",
            "Hasta tres por gravedad, del mismo material; proximidad por presión / 16 psi y O₂ / 32 puntos porcentuales. No implica equivalencia física ni predice este escenario.",
          )}
        </p>
        {experiments.length > 0 &&
          experiments.every((trial) => trial.provenance === "demo") && (
            <p className="evidence-empty">
              {t(
                "Demo catalog: synthetic data do not count as real trials.",
                "Catálogo de demostración: los datos sintéticos no cuentan como ensayos reales.",
              )}
            </p>
          )}
        {nearest.map(({ gravity, trials }) => (
          <section
            key={gravity}
            aria-label={t(
              `${gravityNames[gravity].en} trials`,
              `Ensayos ${gravityNames[gravity].es}`,
            )}
          >
            <h3>
              {gravityNames[gravity][locale]} · {gravityLabels[gravity]}
            </h3>
            {trials.length === 0 ? (
              <p className="evidence-empty">
                {t(
                  "No real trials of the same material and gravity in the loaded catalog.",
                  "Sin ensayos reales del mismo material y gravedad en el catálogo cargado.",
                )}
              </p>
            ) : (
              trials.map((trial) => (
                <article className="nearest-trial" key={trial.id}>
                  <div>
                    <strong>
                      {trial.id} · {observedLabels[trial.outcome][locale]}
                    </strong>
                    <p>
                      {trial.pressure.toFixed(2)} psi ·{" "}
                      {trial.oxygen.toFixed(2)} % O₂
                    </p>
                    <p>
                      {t("Difference:", "Diferencia:")}{" "}
                      {Math.abs(trial.pressure - base.pressure).toFixed(2)} psi
                      · {Math.abs(trial.oxygen - base.oxygen).toFixed(2)}{" "}
                      {t("O₂ points", "puntos de O₂")}
                    </p>
                  </div>
                  <div className="trial-actions">
                    <button
                      className="restore-scenario"
                      onClick={() => {
                        dispatch({ type: "gravity", gravity: trial.gravity });
                        highlightExperiments([trial.id]);
                      }}
                    >
                      {t("View on the map", "Ver en el mapa")}
                    </button>
                    <button
                      className="restore-scenario"
                      onClick={() => load([trial])}
                    >
                      {t("Load", "Cargar")} {trial.id}
                    </button>
                  </div>
                  <details className="trial-sources">
                    <summary>
                      {t(
                        "Source and observed conditions",
                        "Fuente y condiciones observadas",
                      )}
                    </summary>
                    {trial.sources
                      .filter((source) => !source.demo)
                      .map((source, index) => (
                        <blockquote key={`${source.code}-${index}`}>
                          <cite>
                            {source.code} · {source.document} · {source.section}
                          </cite>
                          <p>{source.excerpt}</p>
                          {source.url && /^https?:\/\//i.test(source.url) && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t("Open source", "Consultar fuente")}
                            </a>
                          )}
                        </blockquote>
                      ))}
                  </details>
                </article>
              ))
            )}
          </section>
        ))}
      </details>
    </section>
  );
}
