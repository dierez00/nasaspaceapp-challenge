"use client";
import { useRef, useState, useEffect, useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { ticks } from "d3-array";
import {
  groupCoordinates,
  isLunarZone,
  resolveProbe,
  gravityLabels,
  type Experiment,
} from "../domain/experiment";
import { highlightVisibility, isHighlighted } from "../domain/overlays";
import { useAtlas } from "./atlas-provider";
import "./atlas-map.css";
import { useAudience } from "@/modules/copilot/ui/audience-store";
import { catalogCsv, filterCatalog } from "../domain/catalog";
import { Flame } from "./flame";
import { useSimulation } from "@/modules/simulation/application/simulation-provider";
import { useLocale, useT } from "@/shared/i18n/locale";
import { materialName } from "@/shared/i18n/materials";

export function AtlasMap() {
  const { state, dispatch, experiments, clearOverlays } = useAtlas();
  const audience = useAudience();
  const t = useT();
  const locale = useLocale();
  const [filters, setFilters] = useState({
    material: "",
    oxygenMin: 18,
    oxygenMax: 50,
    pressureMin: 0,
    pressureMax: 16,
  });
  const filtered = useMemo(
    () => filterCatalog(experiments, { ...filters, gravity: state.gravity }),
    [experiments, filters, state.gravity],
  );
  const filterError =
    filters.oxygenMin > filters.oxygenMax ||
    filters.pressureMin > filters.pressureMax;
  const { highlight, gap, focusPending } = state.overlays;
  const highlightSet = useMemo(() => new Set(highlight), [highlight]);
  const [revealedHighlight, setRevealedHighlight] = useState<string | null>(
    null,
  );
  const highlightKey = [...highlightSet].sort().join("|");
  const revealingEvidence =
    highlight.length > 0 && revealedHighlight === highlightKey;
  const displayed = useMemo(() => {
    if (!revealingEvidence) return filtered;
    const filteredIds = new Set(filtered.map((trial) => trial.id));
    return experiments.filter(
      (trial) =>
        filteredIds.has(trial.id) || isHighlighted(trial, highlightSet),
    );
  }, [experiments, filtered, highlightSet, revealingEvidence]);
  const { visible: matchedCount, hidden: hiddenMatches } = useMemo(
    () => highlightVisibility(experiments, displayed, highlightSet),
    [experiments, displayed, highlightSet],
  );
  const outsideFilters = displayed.length - filtered.length;
  const bannerButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusPending) return;
    bannerButton.current?.focus();
    dispatch({ type: "overlay-focused" });
  }, [focusPending, dispatch]);
  const { load } = useSimulation();
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 850, height: 560 });
  const [probe, setProbe] = useState<{
    pressure: number;
    oxygen: number;
  } | null>(null);
  const [overlap, setOverlap] = useState<Experiment[]>([]);
  const [manual, setManual] = useState({ pressure: "8.2", oxygen: "34" });
  const [manualError, setManualError] = useState<
    "" | "invalid" | "out-of-zone"
  >("");
  const [mapNotice, setMapNotice] = useState("");
  useEffect(() => {
    if (!mapNotice) return;
    const timer = setTimeout(() => setMapNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [mapNotice]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const w = Math.max(size.width, 300),
    h = Math.max(size.height, 260);
  const left = w < 500 ? 50 : 65,
    right = 25,
    top = 24,
    bottom = 56;
  const x = scaleLinear()
    .domain([0, 16])
    .range([left, w - right])
    .clamp(true);
  const y = scaleLinear()
    .domain([18, 50])
    .range([h - bottom, top])
    .clamp(true);
  const crowded = experiments.length > 80;
  const nodeScale = crowded ? 0.5 : 1;
  const lunar = probe && isLunarZone(probe.pressure, probe.oxygen);
  function queryPoint(point: { pressure: number; oxygen: number }) {
    dispatch({
      type: "query",
      query: {
        version: 1,
        queryId: crypto.randomUUID(),
        text: `${t("What would happen if we ignite here at 1/6g?", "¿Qué pasaría si encendemos aquí en 1/6g?")} ${point.pressure.toFixed(1)} psi, ${point.oxygen.toFixed(1)}% O₂`,
        context: { ...point, gravity: "lunar" },
      },
    });
  }
  function pointAt(
    event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  ) {
    const rect = svg.current!.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * w) / rect.width,
      py = ((event.clientY - rect.top) * h) / rect.height;
    if (px < left || px > w - right || py < top || py > h - bottom) return null;
    return {
      pressure: Math.round(x.invert(px) * 100) / 100,
      oxygen: Math.round(y.invert(py) * 100) / 100,
    };
  }
  return (
    <section
      className="camera-panel dark-instrument"
      aria-label={t("Atlas camera", "Cámara del Atlas")}
    >
      <header className="camera-heading">
        <div>
          <h2>{t("Evidence map", "Mapa de evidencias")}</h2>
          <p>
            {t(
              "Each flame is a real or demo trial. Tap an empty area to ask what would happen there.",
              "Cada llama es un ensayo real o de demostración. Toca una zona vacía para preguntar qué pasaría allí.",
            )}
          </p>
        </div>
        <span className="map-count">
          <i className="status-dot" />
          {displayed.length} / {experiments.length} {t("trials", "ensayos")} ·{" "}
          {experiments.some((e) => e.provenance === "verified")
            ? "NASA PSI"
            : "demo"}
        </span>
      </header>
      <details className="catalog-filters" open={audience === "researcher"}>
        <summary>
          {t(
            "Catalog filters and export",
            "Filtros y exportación del catálogo",
          )}
        </summary>
        <div className="catalog-filter-fields">
          <label>
            Material
            <select
              aria-label={t("Filter material", "Filtrar material")}
              value={filters.material}
              onChange={(event) =>
                setFilters({ ...filters, material: event.target.value })
              }
            >
              <option value="">
                {t("All materials", "Todos los materiales")}
              </option>
              {[...new Set(experiments.map((trial) => trial.material))]
                .sort()
                .map((material) => (
                  <option key={material} value={material}>
                    {materialName(material, locale)}
                  </option>
                ))}
            </select>
          </label>
          {(
            [
              {
                key: "pressureMin",
                label: t("Minimum pressure", "Presión mínima"),
                unit: "psi",
                min: 0,
                max: 16,
              },
              {
                key: "pressureMax",
                label: t("Maximum pressure", "Presión máxima"),
                unit: "psi",
                min: 0,
                max: 16,
              },
              {
                key: "oxygenMin",
                label: t("Minimum oxygen", "Oxígeno mínimo"),
                unit: "%",
                min: 18,
                max: 50,
              },
              {
                key: "oxygenMax",
                label: t("Maximum oxygen", "Oxígeno máximo"),
                unit: "%",
                min: 18,
                max: 50,
              },
            ] as const
          ).map((field) => (
            <label key={field.key}>
              {field.label} ({field.unit})
              <input
                aria-label={field.label}
                type="number"
                min={field.min}
                max={field.max}
                step="0.1"
                value={filters[field.key]}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value))
                    setFilters({ ...filters, [field.key]: value });
                }}
              />
            </label>
          ))}
        </div>
        {filterError && (
          <p role="alert">
            {t(
              "The minimum cannot exceed the maximum.",
              "El mínimo no puede superar al máximo.",
            )}
          </p>
        )}
        <div className="catalog-actions">
          <button
            disabled={!filtered.length || filterError}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(["\uFEFF", catalogCsv(filtered)], {
                  type: "text/csv;charset=utf-8",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "atlas-filtered-trials.csv";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t(
              `Export ${filtered.length} trials as CSV`,
              `Exportar ${filtered.length} ensayos CSV`,
            )}
          </button>
          <button
            onClick={() => {
              setFilters({
                material: "",
                oxygenMin: 18,
                oxygenMax: 50,
                pressureMin: 0,
                pressureMax: 16,
              });
              dispatch({ type: "gravity", gravity: "all" });
            }}
          >
            {t("Reset filters", "Restablecer filtros")}
          </button>
          <span role="status">
            {t(
              `${filtered.length} trials match your filters · the export keeps provenance and sources.`,
              `${filtered.length} ensayos en tus filtros · la exportación conserva procedencia y fuentes.`,
            )}
          </span>
        </div>
      </details>
      {(highlight.length > 0 || gap) && (
        <div
          className="overlay-banner"
          role="group"
          aria-label={t("Brief highlight", "Resaltado de la ficha")}
        >
          <p id="overlay-banner-text" role="status">
            {highlight.length > 0 &&
              `${matchedCount} ${matchedCount === 1 ? t("trial highlighted", "ensayo resaltado") : t("trials highlighted", "ensayos resaltados")}`}
            {hiddenMatches > 0 &&
              ` · ${hiddenMatches} ${t("brief trials hidden by your filters", "ensayos de la ficha ocultos por tus filtros")}`}
            {outsideFilters > 0 &&
              ` · ${outsideFilters} ${t("brief trials outside your filters; the CSV keeps the filters", "ensayos de la ficha fuera de tus filtros; el CSV conserva los filtros")}`}
            {highlight.length > 0 && gap && " · "}
            {gap &&
              `${gap.label}${gap.region ? "" : t(": no trials in this regime", ": sin ensayos en este régimen")}`}
          </p>
          {(hiddenMatches > 0 || revealingEvidence) && (
            <button
              ref={hiddenMatches > 0 ? bannerButton : undefined}
              type="button"
              aria-describedby="overlay-banner-text"
              onClick={() =>
                setRevealedHighlight(revealingEvidence ? null : highlightKey)
              }
            >
              {revealingEvidence
                ? t("Back to my filters", "Volver a mis filtros")
                : t("Show hidden trials", "Mostrar ensayos ocultos")}
            </button>
          )}
          <button
            ref={hiddenMatches === 0 ? bannerButton : undefined}
            type="button"
            aria-describedby="overlay-banner-text"
            onClick={() => {
              setRevealedHighlight(null);
              clearOverlays();
            }}
          >
            {t("Clear highlight", "Quitar resaltado")}
          </button>
          <button
            type="button"
            className="back-to-assistant"
            onClick={() => {
              dispatch({ type: "assistant", open: true });
              document
                .getElementById("contextual-evidence")
                ?.scrollIntoView({ block: "start" });
            }}
          >
            {t("Back to the assistant", "Volver al asistente")}
          </button>
        </div>
      )}
      <div className="map-stage" ref={container}>
        <svg
          ref={svg}
          className="atlas-svg"
          viewBox={`0 0 ${w} ${h}`}
          role="group"
          aria-label={t("Pressure and oxygen map", "Mapa de presión y oxígeno")}
          onPointerMove={(event) => setProbe(pointAt(event))}
          onPointerLeave={() => setProbe(null)}
          onClick={(event) => {
            const point = pointAt(event);
            if (!point) return;
            const result = resolveProbe(point.pressure, point.oxygen);
            if (result.ok) {
              setMapNotice("");
              queryPoint(result.point);
            } else
              setMapNotice(
                t(
                  "Outside the lunar zone · 0–10.2 psi, 30–50 % O₂",
                  "Fuera de la zona lunar · 0–10.2 psi, 30–50 % O₂",
                ),
              );
          }}
        >
          <defs>
            <pattern
              id="gap-hatch"
              width="9"
              height="9"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="9" height="9" fill="rgba(155, 194, 255, 0.08)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="9"
                stroke="rgba(155, 194, 255, 0.45)"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
          <rect
            x={x(0)}
            y={y(50)}
            width={x(10.2) - x(0)}
            height={y(30) - y(50)}
            className="lunar-fill"
          />
          {ticks(0, 16, 8).map((value) => (
            <g key={`x${value}`}>
              <line
                x1={x(value)}
                x2={x(value)}
                y1={top}
                y2={h - bottom}
                className="grid-line"
              />
              <text
                x={x(value)}
                y={h - bottom + 23}
                textAnchor="middle"
                className="axis-tick"
              >
                {value}
              </text>
            </g>
          ))}
          {[18, 22, 26, 30, 34, 38, 42, 46, 50].map((value) => (
            <g key={`y${value}`}>
              <line
                x1={left}
                x2={w - right}
                y1={y(value)}
                y2={y(value)}
                className="grid-line"
              />
              <text
                x={left - 13}
                y={y(value) + 4}
                textAnchor="end"
                className="axis-tick"
              >
                {value}
              </text>
            </g>
          ))}
          <path
            d={`M${x(0)} ${y(50)} H${x(10.2)} V${y(30)} H${x(0)} Z`}
            className="lunar-outline"
          />
          {gap?.region && (
            <g
              className="gap-overlay"
              data-testid="gap-overlay"
              pointerEvents="none"
            >
              <rect
                x={x(gap.region.pressureMin)}
                y={y(gap.region.oxygenMax)}
                width={Math.max(
                  2,
                  x(gap.region.pressureMax) - x(gap.region.pressureMin),
                )}
                height={Math.max(
                  2,
                  y(gap.region.oxygenMin) - y(gap.region.oxygenMax),
                )}
                fill="url(#gap-hatch)"
                className="gap-region"
              />
              <text
                x={x(gap.region.pressureMin) + 8}
                y={y(gap.region.oxygenMin) - 10}
                className="gap-region-label"
              >
                {gap.label}
              </text>
            </g>
          )}
          <text x={x(10.2) + 7} y={y(30) - 8} className="threshold-label">
            10.2 psi
          </text>
          <text
            x={(left + w - right) / 2}
            y={h - 10}
            textAnchor="middle"
            className="axis-title"
          >
            {t("Absolute pressure (psi)", "Presión absoluta (psi)")}
          </text>
          <text
            transform={`translate(14 ${(top + h - bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="axis-title"
          >
            {t("O₂ concentration (%)", "Concentración de O₂ (%)")}
          </text>
          <g pointerEvents="none">
            <text x={x(1)} y={y(46)} className="zone-label">
              {t("Lunar operating zone", "Zona de operación lunar")}
            </text>
            <text x={x(1)} y={y(46) + 19} className="zone-subtitle">
              ≥ 30 % O₂ · ≤ 10.2 psi
            </text>
            <text x={x(1)} y={y(46) + 38} className="zone-note">
              {t(
                "Query region · not a safety limit",
                "Región de consulta · no es un límite de seguridad",
              )}
            </text>
            <text
              x={x(4.7)}
              y={y(38)}
              className="gap-symbol"
              textAnchor="middle"
            >
              +
            </text>
            <text
              x={x(4.7)}
              y={y(38) + 25}
              className="gap-label"
              textAnchor="middle"
            >
              {t("A territory to explore", "Un territorio por explorar")}
            </text>
            <text
              x={x(4.7)}
              y={y(38) + 42}
              className="gap-hint"
              textAnchor="middle"
            >
              {t(
                "Tap the void. Form a hypothesis.",
                "Toca el vacío. Formula una hipótesis.",
              )}
            </text>
          </g>
          {groupCoordinates(displayed).map((group) => {
            const experiment =
              group.find((e) => e.id === state.selectedId) ?? group[0];
            const matched =
              highlightSet.size === 0 ||
              group.some((e) => isHighlighted(e, highlightSet));
            const active = matched;
            const emphasized = highlightSet.size > 0 && matched;
            const focused = group.some((e) => e.id === state.selectedId);
            return (
              <g
                key={experiment.pressure + ":" + experiment.oxygen}
                transform={`translate(${x(experiment.pressure)},${y(experiment.oxygen)})`}
              >
                <g
                  className="experiment-node"
                  data-testid={`node-${experiment.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${experiment.id}, ${materialName(experiment.material, locale)}, ${experiment.oxygen}% O₂, ${experiment.pressure} psi${group.length > 1 ? `, ${group.length} ${t("overlapping trials", "ensayos coincidentes")}` : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (group.length > 1) setOverlap(group);
                    else load([experiment]);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (group.length > 1) setOverlap(group);
                      else load([experiment]);
                    }
                  }}
                  style={{
                    opacity: active ? 1 : 0.16,
                    transform: `scale(${active ? 1 : 0.88})`,
                  }}
                >
                  <title>
                    {[
                      materialName(experiment.material, locale),
                      gravityLabels[experiment.gravity],
                      experiment.id,
                    ].join(" / ")}
                  </title>
                  <g transform={`scale(${nodeScale})`}>
                    <circle r="22" fill="transparent" />
                    {emphasized && (
                      <circle
                        className="node-highlight"
                        r="25"
                        fill="rgba(11, 61, 145, 0.08)"
                        stroke="var(--nasa-blue)"
                        strokeWidth="2"
                      />
                    )}
                    {focused && (
                      <g fill="none" stroke="var(--nasa-blue)">
                        <circle r="23" />
                        <circle r="27" strokeOpacity=".3" />
                      </g>
                    )}
                    {experiment.outcome === "ignition" && (
                      <circle
                        className="node-outline"
                        r="17"
                        fill="none"
                        stroke={
                          experiment.gravity === "micro" ? "#3B82F6" : "#FF5A1F"
                        }
                        strokeOpacity=".35"
                      />
                    )}
                    <svg
                      x="-23"
                      y="-31"
                      width="46"
                      height="51"
                      viewBox="0 0 100 110"
                    >
                      <Flame
                        gravity={experiment.gravity}
                        outcome={experiment.outcome}
                        compact
                      />
                    </svg>
                  </g>
                  {group.length > 1 && !crowded && (
                    <text x="16" y="-15" className="node-count">
                      {group.length}
                    </text>
                  )}
                </g>
              </g>
            );
          })}
          {probe && (
            <g
              pointerEvents="none"
              stroke={lunar ? "var(--flame-orange-ink)" : "var(--nasa-blue)"}
            >
              <line
                x1={x(probe.pressure)}
                x2={x(probe.pressure)}
                y1={top}
                y2={h - bottom}
                strokeDasharray="3 5"
                opacity=".5"
              />
              <line
                x1={left}
                x2={w - right}
                y1={y(probe.oxygen)}
                y2={y(probe.oxygen)}
                strokeDasharray="3 5"
                opacity=".5"
              />
              <circle
                className={lunar ? "probe-warning" : ""}
                cx={x(probe.pressure)}
                cy={y(probe.oxygen)}
                r="7"
                fill="white"
                fillOpacity=".6"
              />
              <path
                d={`M${x(probe.pressure) - 11} ${y(probe.oxygen)} h22 M${x(probe.pressure)} ${y(probe.oxygen) - 11} v22`}
              />
            </g>
          )}
        </svg>
        {probe && (
          <output
            className={`probe-readout ${lunar ? "critical" : ""}`}
            aria-live="off"
          >
            {probe.pressure.toFixed(2)} <small>psi</small>
            <b> / </b>
            {probe.oxygen.toFixed(2)} <small>% O₂</small>
            <span>
              {lunar
                ? t(
                    "Critical region · illustrative",
                    "Región crítica · ilustrativa",
                  )
                : t("Risk not estimated", "Riesgo no estimado")}
            </span>
          </output>
        )}
        {mapNotice && (
          <output className="probe-notice" role="status">
            {mapNotice}
          </output>
        )}
        {overlap.length > 1 && (
          <div className="overlap-menu">
            <strong>
              {t("Trials at this coordinate", "Ensayos en esta coordenada")} (
              {overlap.length})
            </strong>
            {overlap.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  load([e]);
                  setOverlap([]);
                }}
              >
                {e.id} · {materialName(e.material, locale)}
              </button>
            ))}
            <button onClick={() => setOverlap([])}>
              {t("Close", "Cerrar")}
            </button>
          </div>
        )}
        {!experiments.length && (
          <div className="empty-map">
            {t(
              "No trials available. You can explore coordinates with the probe.",
              "No hay ensayos disponibles. Puedes explorar coordenadas con la sonda.",
            )}
          </div>
        )}
      </div>
      {displayed.length === 0 && (
        <p className="map-empty" role="status">
          {t(
            "No trials match these filters. Reset them to see the full catalog.",
            "No hay ensayos con estos filtros. Restablécelos para volver al catálogo completo.",
          )}
        </p>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-ignition" />{" "}
          {t("Propagated ignition", "Ignición propagada")}
        </span>
        <span>
          <i className="legend-extinction" />{" "}
          {t("Self-extinction", "Autoextinción")}
        </span>
        <span>
          <i className="legend-micro" /> {t("Microgravity", "Microgravedad")}
        </span>
        <span>
          <i className="legend-zone" /> {t("Lunar zone", "Zona lunar")}
        </span>
      </div>
      <footer className="gravity-footer">
        <div className="gravity-title">
          <span className="gravity-name">
            {t("Gravity regime", "Régimen gravitacional")}
          </span>
          <span>
            {state.gravity === "lunar"
              ? `${experiments.filter((trial) => trial.gravity === "lunar").length} ${t("lunar trials in the catalog", "ensayos lunares en el catálogo")}`
              : ""}
          </span>
        </div>
        <div
          className="gravity-control segmented"
          role="group"
          aria-label={t("Gravity regime", "Régimen gravitacional")}
        >
          {(
            [
              { value: "all", title: t("All", "Todas"), sub: "" },
              { value: "micro", title: "µg", sub: "ISS" },
              { value: "lunar", title: "1/6g", sub: t("Moon", "Luna") },
              { value: "earth", title: "1g", sub: t("Earth", "Tierra") },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              data-gravity={item.value}
              aria-pressed={state.gravity === item.value}
              onClick={() => dispatch({ type: "gravity", gravity: item.value })}
            >
              <strong>{item.title}</strong>
              {item.sub && <small>{item.sub}</small>}
            </button>
          ))}
        </div>
      </footer>
      <details className="manual-probe">
        <summary>
          {t("Coordinate probe", "Sonda por coordenadas")}{" "}
          <span aria-hidden="true">↗</span>
        </summary>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const parse = (value: string) =>
              value.trim() === "" ? Number.NaN : Number(value);
            const result = resolveProbe(
              parse(manual.pressure),
              parse(manual.oxygen),
            );
            if (!result.ok) {
              setManualError(result.reason);
              return;
            }
            setManualError("");
            queryPoint(result.point);
          }}
        >
          <label>
            {t("Pressure (psi)", "Presión (psi)")}
            <input
              aria-label={t("Probe pressure", "Presión de la sonda")}
              type="number"
              step="0.1"
              min="0"
              max="10.2"
              value={manual.pressure}
              aria-invalid={manualError ? true : undefined}
              aria-describedby={manualError ? "probe-error" : undefined}
              onChange={(e) => {
                setManualError("");
                setManual({ ...manual, pressure: e.target.value });
              }}
            />
          </label>
          <label>
            {t("Oxygen (%)", "Oxígeno (%)")}
            <input
              aria-label={t("Probe oxygen", "Oxígeno de la sonda")}
              type="number"
              step="0.1"
              min="30"
              max="50"
              value={manual.oxygen}
              aria-invalid={manualError ? true : undefined}
              aria-describedby={manualError ? "probe-error" : undefined}
              onChange={(e) => {
                setManualError("");
                setManual({ ...manual, oxygen: e.target.value });
              }}
            />
          </label>
          <button type="submit">
            {t("Query point →", "Consultar punto →")}
          </button>
          {manualError && (
            <p id="probe-error" className="probe-error" role="alert">
              {manualError === "invalid"
                ? t(
                    "Enter numeric pressure and oxygen values.",
                    "Ingresa valores numéricos de presión y oxígeno.",
                  )
                : t(
                    "Outside the lunar zone: use 0–10.2 psi and 30–50 % O₂.",
                    "Fuera de la zona lunar: usa 0–10.2 psi y 30–50 % O₂.",
                  )}
            </p>
          )}
        </form>
      </details>
    </section>
  );
}
