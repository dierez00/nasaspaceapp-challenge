import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { citationText } from "@/modules/copilot/domain/brief";
import { AtlasMark } from "@/components/brand/atlas-mark";
import { highlightVisibility } from "@/modules/atlas/domain/overlays";
import { catalogCsv, filterCatalog } from "@/modules/atlas/domain/catalog";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import { atlasReducer, initialState } from "@/modules/atlas/ui/atlas-provider";

describe("observatory instrument and evidence", () => {
  it("starts with the instrument, opens evidence for a question and preserves map focus", () => {
    expect(initialState.assistantOpen).toBe(false);
    const question = atlasReducer(initialState, {
      type: "query",
      query: { version: 1, queryId: "test", text: "Question" },
    });
    expect(question.assistantOpen).toBe(true);
    expect(question.tab).toBe("copilot");
    const closed = atlasReducer(question, { type: "assistant", open: false });
    expect(closed.assistantOpen).toBe(false);
    expect(closed.pending).toEqual(question.pending);
    expect(
      atlasReducer(question, { type: "select", id: "DEMO-001" }).assistantOpen,
    ).toBe(false);
    expect(
      atlasReducer(question, { type: "highlight", ids: ["DEMO-001"] }).tab,
    ).toBe("camera");
  });
  it("filters exact inclusive conditions without converting demo provenance into observed evidence", () => {
    const result = filterCatalog(demoExperiments, {
      material: "PMMA",
      oxygenMin: 32,
      oxygenMax: 32,
      pressureMin: 8.2,
      pressureMax: 8.2,
      gravity: "micro",
    });
    expect(result.map((trial) => trial.id)).toEqual(["DEMO-001"]);
    expect(result[0].provenance).toBe("demo");
    expect(
      filterCatalog(result, {
        material: "",
        oxygenMin: 40,
        oxygenMax: 30,
        pressureMin: 0,
        pressureMax: 16,
        gravity: "all",
      }),
    ).toEqual([]);
  });
  it("exports raw values, provenance and original source identifiers with CSV injection protection", () => {
    const csv = catalogCsv([
      { ...demoExperiments[0], material: "=command", outcome: "unknown" },
    ]);
    expect(csv).toContain("pressure_psi,oxygen_percent");
    expect(csv).toContain("'=command,8.2,32,micro,unknown,demo");
    expect(csv).toContain("DEMO-1,Ficha ilustrativa del Atlas");
  });
  it("shares a native orbital mark with a real monochrome silhouette", () => {
    const normal = renderToStaticMarkup(<AtlasMark />);
    const mono = renderToStaticMarkup(<AtlasMark monochrome />);
    expect(normal).toContain('viewBox="0 0 64 64"');
    expect(normal).toContain("radialGradient");
    expect(mono).toContain('fill="currentColor"');
    expect(mono).toContain('stroke="currentColor"');
    expect(mono).not.toContain('fill="url(');
    expect(normal).toContain('aria-hidden="true"');
  });
});

it("does not attribute synthetic demonstration trials to NASA PSI in a citation", () => {
  const text = citationText(
    {
      evidence: {
        title: "Demo",
        experimentIds: ["DEMO-001"],
        columns: [],
        rows: [],
      },
      sourceFiles: [],
    },
    new Date("2026-11-15"),
  );
  expect(text).toContain("datos sintéticos");
  expect(text).not.toContain("NASA Physical Sciences Informatics");
});

it("counts only displayed highlighted trials, including hidden rows of a partially visible investigation", () => {
  const trials = [
    { ...demoExperiments[0], id: "PSI-1/a" },
    { ...demoExperiments[1], id: "PSI-1/b" },
    { ...demoExperiments[2], id: "PSI-2/a" },
  ];
  const highlight = new Set(["PSI-1", "PSI-2"]);
  expect(highlightVisibility(trials, [], highlight)).toEqual({
    visible: 0,
    hidden: 3,
  });
  expect(highlightVisibility(trials, [trials[0]], highlight)).toEqual({
    visible: 1,
    hidden: 2,
  });
  expect(highlightVisibility(trials, trials, highlight)).toEqual({
    visible: 3,
    hidden: 0,
  });
});
