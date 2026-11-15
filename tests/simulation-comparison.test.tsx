import { describe, expect, it } from "vitest";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import type { Experiment } from "@/modules/atlas/domain/experiment";
import { fromExperiment } from "@/modules/simulation/domain/scenario";
import {
  gravityScenarios,
  nearestTrials,
  qualitativeReading,
  timelineExplanation,
} from "@/modules/simulation/domain/comparison";

const base = fromExperiment(demoExperiments[0]);
function observed(patch: Partial<Experiment> = {}): Experiment {
  return {
    ...demoExperiments[0],
    id: "PSI-test",
    provenance: "verified",
    sources: [{ ...demoExperiments[0].sources[0], demo: false }],
    ...patch,
  };
}

describe("three-gravity illustration", () => {
  it("changes only gravity and never presents a derived scenario as observed evidence", () => {
    const before = JSON.stringify(base);
    const scenarios = gravityScenarios(base);
    expect(scenarios.map((scenario) => scenario.gravity)).toEqual([
      "micro",
      "lunar",
      "earth",
    ]);
    for (const scenario of scenarios) {
      expect([
        scenario.material,
        scenario.pressure,
        scenario.oxygen,
        scenario.flameState,
      ]).toEqual([base.material, base.pressure, base.oxygen, base.flameState]);
      expect(scenario.experimentId).toBeUndefined();
      expect(scenario.provenance).toBe("hypothetical");
      expect(scenario.evidence).toBe("none");
      expect(scenario.original).not.toBe(base.original);
    }
    expect(JSON.stringify(base)).toBe(before);
  });
  it("ties readings to the selected phase and respects vacuum, rather than inferring survival", () => {
    expect(qualitativeReading(base, 0)).toContain("Inicio");
    expect(qualitativeReading(base, 4)).toContain("fase elegida");
    expect(
      qualitativeReading({ ...base, flameState: "extinction" }, 4),
    ).toContain("Se extingue");
    expect(
      qualitativeReading({ ...base, flameState: "extinction" }, 8),
    ).toContain("Apagada");
    expect(qualitativeReading({ ...base, pressure: 0 }, 4)).toBe(
      "Sin gas · sin llama",
    );
  });
  it("explains the current timeline segment without claiming validated lunar interpolation", () => {
    expect(timelineExplanation(0).title).toContain("0–2");
    expect(timelineExplanation(2).text).toContain("difusión");
    expect(timelineExplanation(5.99).text).toContain(
      "no una interpolación validada",
    );
    expect(timelineExplanation(6).text).toContain("no una predicción");
    expect(timelineExplanation(8).title).toContain("6–8");
  });
});

describe("nearest observed trials", () => {
  it("excludes demo rows, mismatched materials/gravities and synthetic-only sources", () => {
    const real = observed();
    expect(
      nearestTrials(
        [
          ...demoExperiments,
          real,
          observed({ id: "wrong-material", material: "Nomex" }),
          observed({ id: "wrong-gravity", gravity: "earth" }),
          observed({
            id: "synthetic-source",
            sources: demoExperiments[0].sources,
          }),
          observed({ id: "no-source", sources: [] }),
        ],
        base,
        "micro",
      ),
    ).toEqual([real]);
  });
  it("ranks normalized pressure/oxygen distance deterministically without mutating rows", () => {
    const trials = [
      observed({ id: "far", pressure: 12 }),
      observed({ id: "B", pressure: 8.2, oxygen: 32 }),
      observed({ id: "A", pressure: 8.2, oxygen: 32, outcome: "unknown" }),
    ];
    const before = JSON.stringify(trials);
    expect(nearestTrials(trials, base, "micro").map((row) => row.id)).toEqual([
      "A",
      "B",
    ]);
    expect(JSON.stringify(trials)).toBe(before);
    expect(nearestTrials(trials, base, "lunar")).toEqual([]);
    expect(nearestTrials(trials, base, "micro", 0)).toEqual([]);
  });
});

// Render the real evidence boundary as well as exercising the ranking function.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AtlasProvider } from "@/modules/atlas/ui/atlas-provider";
import { SimulationProvider } from "@/modules/simulation/application/simulation-provider";
import { ComparisonNotes } from "@/modules/simulation/ui/comparison-notes";

it("renders original source text and unknown outcomes separately from the illustration", () => {
  const trial = observed({
    outcome: "unknown",
    sources: [
      {
        ...observed().sources[0],
        code: "PSI-test",
        excerpt: "Exact observed excerpt",
        url: "javascript:alert(1)",
      },
    ],
  });
  const markup = renderToStaticMarkup(
    <AtlasProvider experiments={[trial]}>
      <SimulationProvider initialExperiment={trial}>
        <ComparisonNotes />
      </SimulationProvider>
    </AtlasProvider>,
  );
  expect(markup).toContain("Resultado no determinado");
  expect(markup).toContain("Exact observed excerpt");
  expect(markup).toContain("ni predice este escenario");
  expect(markup).not.toContain("javascript:");
});
