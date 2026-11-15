"use client";

import { useMemo } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { gravityLabels } from "@/modules/atlas/domain/experiment";
import { useSimulation } from "../application/simulation-provider";
import {
  comparisonGravities,
  gravityNames,
  nearestTrials,
} from "../domain/comparison";

const observedLabels = {
  ignition: "Ignición registrada",
  extinction: "Extinción registrada",
  unknown: "Resultado no determinado",
};

export function ComparisonNotes() {
  const { experiments, highlightExperiments, dispatch } = useAtlas();
  const { state, load } = useSimulation();
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
    <section className="comparison-notes" aria-label="Lectura comparativa">
      <details className="nearest-trials evidence-paper">
        <summary>Ensayos y fuentes · contrastar con datos reales</summary>
        <p>
          Hasta tres por gravedad, del mismo material; proximidad por presión / 16 psi y O₂ / 32
          puntos porcentuales. No implica equivalencia física ni predice este
          escenario.
        </p>
        {experiments.length > 0 &&
          experiments.every((trial) => trial.provenance === "demo") && (
            <p className="evidence-empty">
              Catálogo de demostración: los datos sintéticos no cuentan como
              ensayos reales.
            </p>
          )}
        {nearest.map(({ gravity, trials }) => (
          <section
            key={gravity}
            aria-label={`Ensayos ${gravityNames[gravity]}`}
          >
            <h3>
              {gravityNames[gravity]} · {gravityLabels[gravity]}
            </h3>
            {trials.length === 0 ? (
              <p className="evidence-empty">
                Sin ensayos reales del mismo material y gravedad en el catálogo
                cargado.
              </p>
            ) : (
              trials.map((trial) => (
                <article className="nearest-trial" key={trial.id}>
                  <div>
                    <strong>
                      {trial.id} · {observedLabels[trial.outcome]}
                    </strong>
                    <p>
                      {trial.pressure.toFixed(2)} psi ·{" "}
                      {trial.oxygen.toFixed(2)} % O₂
                    </p>
                    <p>
                      Diferencia:{" "}
                      {Math.abs(trial.pressure - base.pressure).toFixed(2)} psi
                      · {Math.abs(trial.oxygen - base.oxygen).toFixed(2)} puntos
                      de O₂
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
                      Ver en el mapa
                    </button>
                    <button
                      className="restore-scenario"
                      onClick={() => load([trial])}
                    >
                      Cargar {trial.id}
                    </button>
                  </div>
                  <details className="trial-sources">
                    <summary>Fuente y condiciones observadas</summary>
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
                              Consultar fuente
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
