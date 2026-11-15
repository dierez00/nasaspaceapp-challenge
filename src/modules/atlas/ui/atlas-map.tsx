"use client";
import { useRef, useState, useEffect } from "react";
import { scaleLinear } from "d3-scale";
import { ticks } from "d3-array";
import {
  groupCoordinates,
  isLunarZone,
  resolveProbe,
  gravityLabels,
  type Experiment,
} from "../domain/experiment";
import { useAtlas } from "./atlas-provider";
import "./atlas-map.css";
import { Flame } from "./flame";
import { useSimulation } from "@/modules/simulation/application/simulation-provider";

export function AtlasMap() {
  const { state, dispatch, experiments } = useAtlas();
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
  const [manualError, setManualError] = useState("");
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
        text: `¿Qué pasaría si encendemos aquí en 1/6g? ${point.pressure.toFixed(1)} psi, ${point.oxygen.toFixed(1)}% O₂`,
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
    <section className="camera-panel" aria-label="Cámara del Atlas">
      <header className="camera-heading">
        <div>
          <h2>Mapa de evidencias</h2>
          <p>
            Cada llama es un ensayo real o de demostración. Toca una zona vacía
            para preguntar qué pasaría allí.
          </p>
        </div>
        <span className="map-count">
          <i className="status-dot" />
          {experiments.length} ensayos ·{" "}
          {experiments.some((e) => e.provenance === "verified")
            ? "NASA PSI"
            : "demo"}
        </span>
      </header>
      <div className="map-stage" ref={container}>
        <svg
          ref={svg}
          className="atlas-svg"
          viewBox={`0 0 ${w} ${h}`}
          role="group"
          aria-label="Mapa de presión y oxígeno"
          onPointerMove={(event) => setProbe(pointAt(event))}
          onPointerLeave={() => setProbe(null)}
          onClick={(event) => {
            const point = pointAt(event);
            if (!point) return;
            const result = resolveProbe(point.pressure, point.oxygen);
            if (result.ok) {
              setMapNotice("");
              queryPoint(result.point);
            } else setMapNotice("Fuera de la zona lunar · 0–10.2 psi, 30–50 % O₂");
          }}
        >
          <defs>
            <linearGradient id="scan-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#FF5A1F" stopOpacity="0" />
              <stop offset="1" stopColor="#FF5A1F" stopOpacity=".07" />
            </linearGradient>
            <clipPath id="lunar-clip">
              <rect
                x={x(0)}
                y={y(50)}
                width={x(10.2) - x(0)}
                height={y(30) - y(50)}
              />
            </clipPath>
          </defs>
          <rect
            x={x(0)}
            y={y(50)}
            width={x(10.2) - x(0)}
            height={y(30) - y(50)}
            className="lunar-fill"
          />
          <g clipPath="url(#lunar-clip)" pointerEvents="none">
            <rect
              className="laser-scan"
              x={x(0)}
              y={y(50)}
              width={x(10.2) - x(0)}
              height="65"
              fill="url(#scan-gradient)"
            />
          </g>
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
          <text x={x(10.2) + 7} y={y(30) - 8} className="threshold-label">
            10.2 psi
          </text>
          <text
            x={(left + w - right) / 2}
            y={h - 10}
            textAnchor="middle"
            className="axis-title"
          >
            Presión absoluta (psi)
          </text>
          <text
            transform={`translate(14 ${(top + h - bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="axis-title"
          >
            Concentración de O₂ (%)
          </text>
          <g pointerEvents="none">
            <text x={x(1)} y={y(46)} className="zone-label">
              Zona de operación lunar
            </text>
            <text x={x(1)} y={y(46) + 19} className="zone-subtitle">
              ≥ 30 % O₂ · ≤ 10.2 psi
            </text>
            <text x={x(1)} y={y(46) + 38} className="zone-note">
              Riesgo de ignición · ilustrativo
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
              Un territorio por explorar
            </text>
            <text
              x={x(4.7)}
              y={y(38) + 42}
              className="gap-hint"
              textAnchor="middle"
            >
              Toca el vacío. Formula una hipótesis.
            </text>
          </g>
          {groupCoordinates(experiments).map((group) => {
            const experiment =
              group.find((e) => e.id === state.selectedId) ?? group[0];
            const active =
              state.gravity === "all" || state.gravity === experiment.gravity;
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
                  aria-label={`${experiment.id}, ${experiment.material}, ${experiment.oxygen}% O₂, ${experiment.pressure} psi${group.length > 1 ? `, ${group.length} ensayos coincidentes` : ""}`}
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
                      experiment.material,
                      gravityLabels[experiment.gravity],
                      experiment.id,
                    ].join(" / ")}
                  </title>
                  <g transform={`scale(${nodeScale})`}>
                  <circle r="22" fill="transparent" />
                  {focused && (
                    <g fill="none" stroke="#0B3D91">
                      <circle r="23" />
                      <circle r="27" strokeOpacity=".3" />
                    </g>
                  )}
                  {experiment.outcome === "ignition" && (
                    <circle
                      className="node-pulse"
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
            <g pointerEvents="none" stroke={lunar ? "#B93A0E" : "#0B3D91"}>
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
              {lunar ? "Región crítica · ilustrativa" : "Riesgo no estimado"}
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
            <strong>Ensayos en esta coordenada ({overlap.length})</strong>
            {overlap.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  load([e]);
                  setOverlap([]);
                }}
              >
                {e.id} · {e.material}
              </button>
            ))}
            <button onClick={() => setOverlap([])}>Cerrar</button>
          </div>
        )}
        {!experiments.length && (
          <div className="empty-map">
            No hay ensayos disponibles. Puedes explorar coordenadas con la
            sonda.
          </div>
        )}
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-ignition" /> Ignición propagada
        </span>
        <span>
          <i className="legend-extinction" /> Autoextinción
        </span>
        <span>
          <i className="legend-micro" /> Microgravedad
        </span>
        <span>
          <i className="legend-zone" /> Zona lunar
        </span>
      </div>
      <footer className="gravity-footer">
        <div className="gravity-title">
          <span className="gravity-name">Régimen gravitacional</span>
          <span>
            {state.gravity === "lunar"
              ? "Sin ensayos lunares en el catálogo"
              : ""}
          </span>
        </div>
        <div
          className="gravity-control segmented"
          role="group"
          aria-label="Régimen gravitacional"
        >
          {(
            [
              { value: "all", title: "Todas", sub: "" },
              { value: "micro", title: "µg", sub: "ISS" },
              { value: "lunar", title: "1/6g", sub: "Luna" },
              { value: "earth", title: "1g", sub: "Tierra" },
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
          Sonda por coordenadas <span aria-hidden="true">↗</span>
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
              setManualError(
                result.reason === "invalid"
                  ? "Ingresa valores numéricos de presión y oxígeno."
                  : "Fuera de la zona lunar: usa 0–10.2 psi y 30–50 % O₂.",
              );
              return;
            }
            setManualError("");
            queryPoint(result.point);
          }}
        >
          <label>
            Presión (psi)
            <input
              aria-label="Presión de la sonda"
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
            Oxígeno (%)
            <input
              aria-label="Oxígeno de la sonda"
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
          <button type="submit">Consultar punto →</button>
          {manualError && (
            <p id="probe-error" className="probe-error" role="alert">
              {manualError}
            </p>
          )}
        </form>
      </details>
    </section>
  );
}
