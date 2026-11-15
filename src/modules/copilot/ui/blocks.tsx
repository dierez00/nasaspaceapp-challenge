"use client";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { Flame } from "@/modules/atlas/ui/flame";
import { gravityLabels, type Source } from "@/modules/atlas/domain/experiment";
import { atlasGravity, compactColumns } from "../domain/brief";
import { useSimulation } from "@/modules/simulation/application/simulation-provider";
import type { UIBlock } from "../domain/contracts";
import { EvidenceBrief } from "./evidence-brief";
import { EvidenceTable } from "./evidence-table";
import { Prose } from "./prose";
import "./copilot.css";

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <details className="source-list">
      <summary>
        <span>Fuentes</span>
        <span>{sources.length} ↗</span>
      </summary>
      {sources.length ? (
        sources.map((source, index) => (
          <article key={index}>
            <span className="source-kind">
              {source.code} ·{" "}
              {source.demo ? "Referencia demostrativa" : "Fuente"}
            </span>
            <strong>{source.document}</strong>
            <small>{source.section}</small>
            <p>{source.excerpt}</p>
            {source.url && /^https?:\/\//.test(source.url) && (
              <a href={source.url} target="_blank" rel="noreferrer">
                Abrir documento ↗
              </a>
            )}
          </article>
        ))
      ) : (
        <p>No hay fuentes disponibles para este bloque.</p>
      )}
    </details>
  );
}
export function GravityBounds({ explanation }: { explanation: string }) {
  const { edit } = useSimulation();
  const { dispatch } = useAtlas();
  return (
    <article className="immersive-card">
      <div className="card-kicker">
        <span>Tres gravedades</span>
        <span>↗</span>
      </div>
      <h3>Entra en la cámara.</h3>
      <div className="immersive-orbit" aria-hidden="true">
        <span>µg</span>
        <i />
        <span>⅙g</span>
        <i />
        <span>1g</span>
      </div>
      <p>{explanation}</p>
      <div className="gravity-preset-actions">
        {(["micro", "lunar", "earth"] as const).map((gravity) => (
          <button
            key={gravity}
            onClick={() => {
              edit("A", { gravity });
              dispatch({ type: "view", view: "lab" });
              dispatch({ type: "tab", tab: "camera" });
            }}
          >
            Explorar {gravityLabels[gravity]}
          </button>
        ))}
      </div>
    </article>
  );
}
function MapFocus({
  block,
}: {
  block: Extract<UIBlock, { type: "MapFocus" }>;
}) {
  const { dispatch, highlightExperiments } = useAtlas();
  return (
    <article className="generative-card map-focus">
      <h3>{block.title}</h3>
      {block.note && <p>{block.note}</p>}
      <button
        type="button"
        className="brief-button"
        onClick={() => {
          dispatch({
            type: "gravity",
            gravity: atlasGravity(block.gravity) ?? "all",
          });
          if (block.experimentIds.length)
            highlightExperiments(block.experimentIds);
          else dispatch({ type: "view", view: "map" });
        }}
      >
        Ver en el mapa
      </button>
    </article>
  );
}
export function BlockRenderer({ block }: { block: UIBlock }) {
  const { experiments, state } = useAtlas();
  const { load } = useSimulation();
  if (block.type === "EvidenceBrief") return <EvidenceBrief block={block} />;
  if (block.type === "DataTable")
    return (
      <article className="generative-card data-table">
        <h3>{block.title}</h3>
        <EvidenceTable
          title={block.title}
          columns={block.columns}
          rows={block.rows}
          visible={compactColumns(block.columns)}
        />
      </article>
    );
  if (block.type === "Notice")
    return (
      <aside className={`notice-card is-${block.level}`}>
        <span className="label">
          {block.level === "warning" ? "Ten en cuenta" : "Nota"}
        </span>
        <p>{block.message}</p>
      </aside>
    );
  if (block.type === "Narrative") return <Prose markdown={block.markdown} />;
  if (block.type === "MapFocus") return <MapFocus block={block} />;
  if (block.type === "GravityBounds")
    return <GravityBounds explanation={block.explanation} />;
  if (block.type === "SourceList")
    return <SourceList sources={block.sources} />;
  if (block.type === "FallbackCard")
    return (
      <article className="generative-card fallback-card">
        <Prose markdown={block.markdown} />
        {block.sources.length > 0 && <SourceList sources={block.sources} />}
      </article>
    );
  if (block.type === "ExperimentCard") {
    const experiment = experiments.find((e) => e.id === block.experimentId);
    if (!experiment)
      return (
        <article className="generative-card">
          El ensayo solicitado no está disponible en este catálogo.
        </article>
      );
    return (
      <article
        className={`generative-card experiment-card ${state.selectedId === experiment.id ? "is-selected" : ""}`}
      >
        <div className="experiment-preview">
          <Flame gravity={experiment.gravity} outcome={experiment.outcome} />
        </div>
        <div className="experiment-details">
          <div className="card-kicker">
            <span>{experiment.id}</span>
            <span>
              {experiment.provenance === "demo" ? "Demo" : "Verificado"}
            </span>
          </div>
          <h3>{experiment.material}</h3>
          <div className="condition-badges">
            <span>{experiment.oxygen}% O₂</span>
            <span>{experiment.pressure} psi</span>
            <span>{gravityLabels[experiment.gravity]}</span>
          </div>
          <p>
            Propagación{" "}
            <strong>
              {experiment.spreadRate === null
                ? "Desconocida"
                : `${experiment.spreadRate} mm/s`}
            </strong>
          </p>
          <button className="focus-button" onClick={() => load([experiment])}>
            ⊕ Abrir en laboratorio 3D <span>↗</span>
          </button>
        </div>
      </article>
    );
  }
  const samples = block.experimentIds
    .map((id) => experiments.find((experiment) => experiment.id === id))
    .filter((experiment) => experiment !== undefined);
  return (
    <article className="immersive-card">
      <div className="card-kicker">
        <span>Comparación</span>
        <span>A / B</span>
      </div>
      <h3>Dos llamas. Un mismo instante.</h3>
      <p>
        {samples
          .slice(0, 2)
          .map(
            (experiment) =>
              `${experiment.material} (${gravityLabels[experiment.gravity]})`,
          )
          .join(" / ")}
      </p>
      <p>
        Compara forma, propagación y extinción con controles independientes y
        reproducción sincronizada.
      </p>
      <button
        disabled={samples.length < 2}
        onClick={() => load(samples.slice(0, 2))}
      >
        Abrir comparación 3D <span>↗</span>
      </button>
      {samples.length < 2 && (
        <p>No hay dos muestras disponibles en el catálogo.</p>
      )}
      {samples.length > 2 && (
        <p>Se abrirán las primeras dos muestras disponibles.</p>
      )}
    </article>
  );
}
