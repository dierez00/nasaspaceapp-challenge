"use client";
import { useId, useMemo, useRef, useState } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { useSimulation } from "@/modules/simulation/application/simulation-provider";
import {
  atlasGravity,
  audienceHeading,
  audienceLabel,
  audiences,
  citationText,
  compactColumns,
  evidenceCsv,
  experimentProposal,
  gapFacts,
  gapMapLabel,
  gapRegion,
  labParamsFromStep,
  stepHint,
  type BriefStep,
  type EvidenceBriefBlock,
} from "../domain/brief";
import { setAudience, useAudience } from "./audience-store";
import { useLocale, useT } from "@/shared/i18n/locale";
import { EvidenceTable } from "./evidence-table";
import { Prose } from "./prose";
import "./brief.css";

const stepGlyph = { simulate: "▶", propose_experiment: "✎", explore_map: "⌖" };

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadCsv(name: string, csv: string) {
  // The BOM makes spreadsheets read accents as UTF-8.
  const url = URL.createObjectURL(
    new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function EvidenceBrief({ block }: { block: EvidenceBriefBlock }) {
  const id = useId();
  const audience = useAudience();
  const locale = useLocale();
  const t = useT();
  const { dispatch, experiments, highlightExperiments, showGap } = useAtlas();
  const { simulate } = useSimulation();
  const [notice, setNotice] = useState<string[]>([]);
  const [proposal, setProposal] = useState<BriefStep | null>(null);
  const [copied, setCopied] = useState("");
  const proposalHeading = useRef<HTMLHeadingElement>(null);
  const { evidence, gap, nextSteps } = block;
  const materials = useMemo(
    () => [
      ...new Set([
        ...experiments.map((e) => e.material),
        "PMMA",
        "Nomex",
        "Cotton",
      ]),
    ],
    [experiments],
  );
  const columnsShown = useMemo(
    () =>
      evidence
        ? audience === "researcher"
          ? evidence.columns.map((_, index) => index)
          : compactColumns(evidence.columns)
        : [],
    [evidence, audience],
  );
  const hiddenColumns = evidence
    ? evidence.columns.length - columnsShown.length
    : 0;
  const region = gap ? gapRegion(gap) : null;

  function showGapOnMap() {
    if (!gap) return;
    showGap({ label: gapMapLabel(gap, locale), region });
    const gravity = atlasGravity(gap.gravity);
    if (gravity) dispatch({ type: "gravity", gravity });
  }
  function act(step: BriefStep) {
    setNotice([]);
    setProposal(null);
    if (step.kind === "simulate") {
      const { patch, summary, notes } = labParamsFromStep(
        step,
        materials,
        locale,
      );
      simulate(patch);
      dispatch({ type: "view", view: "lab" });
      dispatch({ type: "tab", tab: "camera" });
      setNotice([summary, ...notes]);
    } else if (step.kind === "explore_map") {
      dispatch({
        type: "gravity",
        gravity: atlasGravity(step.gravity) ?? "all",
      });
      if (gap) showGap({ label: gapMapLabel(gap, locale), region });
      else dispatch({ type: "view", view: "map" });
      if (!gap) dispatch({ type: "tab", tab: "camera" });
    } else {
      setProposal(step);
      requestAnimationFrame(() => proposalHeading.current?.focus());
    }
  }
  async function copy(key: string, text: string) {
    const ok = await copyText(text);
    setCopied(ok ? key : `${key}-failed`);
    setTimeout(() => setCopied(""), 2400);
  }
  const proposalDraft = proposal
    ? experimentProposal(gap, proposal, locale)
    : null;
  const facts = gap ? gapFacts(gap, locale) : [];

  return (
    <article className="brief" aria-labelledby={`${id}-verdict`}>
      <header className="brief-verdict">
        <span className="label">{t("Verdict", "Veredicto")}</span>
        <h3 id={`${id}-verdict`}>{block.verdict}</h3>
        {block.lead && <p className="brief-lead">{block.lead}</p>}
      </header>

      <section
        className="brief-lens"
        aria-label={t("Reading for your profile", "Lectura según tu perfil")}
      >
        <div
          className="lens-switch"
          role="group"
          aria-label={t("Read the brief as", "Leer la ficha como")}
        >
          {audiences.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={audience === item}
              onClick={() => setAudience(item)}
            >
              {audienceLabel(item, locale)}
            </button>
          ))}
        </div>
        <p className="lens-text">
          <strong>{audienceHeading(audience, locale)}. </strong>
          {block.lenses[audience]}
        </p>
      </section>

      {evidence && (
        <section className="brief-section" aria-labelledby={`${id}-evidence`}>
          <div className="brief-section-head">
            <h4 id={`${id}-evidence`}>{t("Evidence", "Evidencia")}</h4>
            <span>
              {evidence.rows.length}{" "}
              {evidence.rows.length === 1
                ? t("row", "fila")
                : t("rows", "filas")}
            </span>
          </div>
          <p className="brief-caption">{evidence.title}</p>
          <EvidenceTable
            key={audience === "researcher" ? "all" : "compact"}
            title={evidence.title}
            columns={evidence.columns}
            rows={evidence.rows}
            visible={columnsShown}
          />
          {hiddenColumns > 0 && (
            <p className="brief-fineprint">
              {t(
                `Showing ${columnsShown.length} of ${evidence.columns.length} columns. The researcher reading shows them all.`,
                `Se muestran ${columnsShown.length} de ${evidence.columns.length} columnas. La lectura de investigador las muestra todas.`,
              )}
            </p>
          )}
          <div className="brief-actions">
            {evidence.experimentIds.length > 0 && (
              <button
                type="button"
                className="brief-button"
                onClick={() => highlightExperiments(evidence.experimentIds)}
              >
                {t("Show on the map", "Ver en el mapa")}
                <span className="brief-count">
                  {evidence.experimentIds.length}
                </span>
              </button>
            )}
            {audience === "researcher" && (
              <>
                <button
                  type="button"
                  className="brief-button"
                  onClick={() =>
                    downloadCsv(
                      t("atlas-evidence.csv", "atlas-evidencia.csv"),
                      evidenceCsv(evidence),
                    )
                  }
                >
                  {t("Download CSV", "Descargar CSV")}
                </button>
                <button
                  type="button"
                  className="brief-button"
                  onClick={() =>
                    void copy("cite", citationText(block, new Date(), locale))
                  }
                >
                  {t("Copy citation", "Copiar cita")}
                </button>
              </>
            )}
          </div>
          <p className="brief-fineprint" role="status">
            {copied === "cite" &&
              t(
                "Citation copied to the clipboard.",
                "Cita copiada al portapapeles.",
              )}
            {copied === "cite-failed" &&
              t(
                "Couldn't copy. Your browser blocked the clipboard.",
                "No se pudo copiar. Tu navegador bloqueó el portapapeles.",
              )}
          </p>
        </section>
      )}

      {gap && (
        <section className="brief-section" aria-labelledby={`${id}-gap`}>
          <div className="brief-section-head">
            <h4 id={`${id}-gap`}>{t("Gap", "Hueco")}</h4>
          </div>
          <p className="brief-gap">{gap.description}</p>
          {facts.length > 0 && (
            <dl className="gap-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="brief-actions">
            <button
              type="button"
              className="brief-button"
              onClick={showGapOnMap}
            >
              {t("Show gap on the map", "Ver hueco en el mapa")}
            </button>
          </div>
        </section>
      )}

      {nextSteps.length > 0 && (
        <section className="brief-section" aria-labelledby={`${id}-next`}>
          <div className="brief-section-head">
            <h4 id={`${id}-next`}>
              {nextSteps.length === 1
                ? t("Next step", "Siguiente paso")
                : t("Next steps", "Siguientes pasos")}
            </h4>
          </div>
          <ul className="next-steps">
            {nextSteps.map((step, index) => (
              <li key={index}>
                <button type="button" onClick={() => act(step)}>
                  <span className="step-glyph" aria-hidden="true">
                    {stepGlyph[step.kind]}
                  </span>
                  <span className="step-copy">
                    <strong>{step.label}</strong>
                    <small>{stepHint(step, materials, locale)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {notice.length > 0 && (
            <div className="step-notice" role="status">
              {notice.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
          {proposal && proposalDraft && (
            <div className="proposal">
              <h5 ref={proposalHeading} tabIndex={-1}>
                {t("Experiment proposal", "Propuesta de experimento")}
              </h5>
              <p className="proposal-title">{proposalDraft.title}</p>
              <p className="label">
                {t("Conditions to test", "Condiciones a probar")}
              </p>
              <ul>
                {proposalDraft.conditions.length ? (
                  proposalDraft.conditions.map((line) => (
                    <li key={line}>{line}</li>
                  ))
                ) : (
                  <li>
                    {t(
                      "To be defined with the team.",
                      "Por definir con el equipo.",
                    )}
                  </li>
                )}
              </ul>
              <p className="label">{t("What to measure", "Qué medir")}</p>
              <ul>
                {proposalDraft.measure.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="brief-actions">
                <button
                  type="button"
                  className="brief-button"
                  onClick={() => void copy("proposal", proposalDraft.text)}
                >
                  {t("Copy proposal", "Copiar propuesta")}
                </button>
                <button
                  type="button"
                  className="brief-button brief-button-quiet"
                  onClick={() => setProposal(null)}
                >
                  {t("Close", "Cerrar")}
                </button>
              </div>
              <p className="brief-fineprint" role="status">
                {copied === "proposal" &&
                  t(
                    "Proposal copied to the clipboard.",
                    "Propuesta copiada al portapapeles.",
                  )}
                {copied === "proposal-failed" &&
                  t(
                    "Couldn't copy. Select the text manually.",
                    "No se pudo copiar. Selecciona el texto manualmente.",
                  )}
              </p>
            </div>
          )}
        </section>
      )}

      {block.analysis && (
        <details className="brief-analysis">
          <summary>{t("Full analysis", "Análisis completo")}</summary>
          <Prose markdown={block.analysis} />
        </details>
      )}
    </article>
  );
}
