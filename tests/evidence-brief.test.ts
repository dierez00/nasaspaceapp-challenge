import { describe, expect, it } from "vitest";
import {
  atlasGravity,
  citationText,
  columnLabel,
  compactColumns,
  evidenceCsv,
  experimentProposal,
  formatCell,
  formatNumber,
  formatRange,
  gapFacts,
  gapRegion,
  informativeLead,
  kpaToPsi,
  labParamsFromStep,
  matchMaterial,
  progressCopy,
  psiToKpa,
  sortRows,
  type BriefGap,
  type BriefStep,
} from "@/modules/copilot/domain/brief";
import { validateBlock } from "@/modules/copilot/domain/contracts";
import {
  translateBackendStream,
  translateUi,
} from "@/modules/copilot/infra/backend-query";
import { atlasReducer, initialState } from "@/modules/atlas/ui/atlas-provider";
import { isHighlighted } from "@/modules/atlas/domain/overlays";

const brief = {
  type: "brief",
  verdict: "No hay ensayos de sólidos con más de 30 % de O₂.",
  evidence: {
    title: "Ensayos de sólidos según la base del O₂",
    columns: ["o2_basis", "ensayos", "experimentos", "o2_percent_promedio"],
    rows: [["ambient", 158, "PSI-26, PSI-99", 21.0304]],
    experiment_ids: ["PSI-26", "PSI-99"],
  },
  gap: {
    description: "No hay ensayos de sólidos con más de 30 % de O₂.",
    pressure_kpa_min: null,
    pressure_kpa_max: null,
    o2_percent_min: 30.01,
    o2_percent_max: null,
    gravity: null,
  },
  next_steps: [
    {
      kind: "propose_experiment",
      label: "Proponer ensayo",
      pressure_kpa: null,
      o2_percent: 30,
      gravity: null,
      material: null,
    },
  ],
  lenses: { student: "e", teacher: "d", researcher: "i" },
};

describe("translateUi", () => {
  it("turns a brief into one evidence brief block with real data", () => {
    const { text, blocks } = translateUi({
      summary: "Resumen",
      components: [
        brief,
        {
          type: "table",
          title: "Ensayos de sólidos según la base del O₂",
          columns: brief.evidence.columns,
          rows: brief.evidence.rows,
        },
        {
          type: "citations",
          items: [
            {
              experiment_id: "PSI-26",
              source_file: "PSI-26_a.pdf",
              section: "p. 4",
              quote: "cita",
            },
          ],
        },
        { type: "text", body: "**Detalle** del análisis" },
      ],
    });
    expect(text).toBe("");
    expect(blocks.map((b) => b.type)).toEqual(["EvidenceBrief", "SourceList"]);
    const result = validateBlock(blocks[0]);
    expect(result).toMatchObject({
      type: "EvidenceBrief",
      verdict: brief.verdict,
      analysis: "**Detalle** del análisis",
      sourceFiles: ["PSI-26_a.pdf"],
      evidence: { experimentIds: ["PSI-26", "PSI-99"] },
      gap: { o2PercentMin: 30.01, gravity: null },
      nextSteps: [{ kind: "propose_experiment", o2Percent: 30 }],
    });
  });

  it("keeps a table that differs from the evidence and never flattens it to markdown", () => {
    const { blocks } = translateUi({
      summary: "x",
      components: [
        brief,
        { type: "table", title: "Otra", columns: ["a"], rows: [[1]] },
      ],
    });
    expect(blocks.map((b) => b.type)).toEqual(["EvidenceBrief", "DataTable"]);
    expect(blocks[1]).toEqual({
      type: "DataTable",
      title: "Otra",
      columns: ["a"],
      rows: [[1]],
    });
  });

  it("falls back to summary plus components when there is no brief", () => {
    const { text, blocks } = translateUi({
      summary: "Resumen",
      components: [
        { type: "text", body: "Detalle" },
        { type: "notice", level: "warning", message: "Dato supuesto" },
        { type: "notice", level: "otro", message: "Nota" },
        {
          type: "gap_map",
          title: "h",
          experiment_ids: [],
          gravity_environment: "partial",
          note: null,
        },
        { type: "desconocido", foo: 1 },
      ],
    });
    expect(text).toBe("Resumen");
    expect(blocks).toEqual([
      { type: "Narrative", markdown: "Detalle" },
      { type: "Notice", level: "warning", message: "Dato supuesto" },
      { type: "Notice", level: "info", message: "Nota" },
      {
        type: "MapFocus",
        title: "h",
        experimentIds: [],
        gravity: null,
        note: null,
      },
    ]);
  });

  it("ignores a malformed brief instead of failing the answer", () => {
    const { blocks } = translateUi({
      summary: "Resumen",
      components: [
        { type: "brief", verdict: "" },
        { type: "text", body: "ok" },
      ],
    });
    expect(blocks).toEqual([{ type: "Narrative", markdown: "ok" }]);
  });

  it("lists citations with the exact file and section", () => {
    const { blocks } = translateUi({
      summary: "x",
      components: [
        {
          type: "citations",
          items: [
            {
              experiment_id: "PSI-25",
              source_file: "f.pdf",
              section: "p. 50",
              quote: "q",
            },
            {
              experiment_id: "PSI-26",
              source_file: "g.csv",
              section: null,
              quote: "r",
            },
          ],
        },
      ],
    });
    expect(blocks[0]).toMatchObject({
      type: "SourceList",
      sources: [
        { document: "f.pdf", code: "PSI-25", section: "p. 50" },
        { document: "g.csv", code: "PSI-26", section: "—" },
      ],
    });
  });

  it("handles worst-case briefs: 0 steps, null gap and evidence, 50 rows, long text", () => {
    const rows = Array.from({ length: 300 }, (_, i) => [`PSI-${i}`, i]);
    const { blocks } = translateUi({
      summary: "s",
      components: [
        {
          ...brief,
          verdict: "V".repeat(2000),
          gap: null,
          next_steps: [],
          evidence: {
            title: "t",
            columns: ["experiment_id", "n"],
            rows,
            experiment_ids: [],
          },
        },
      ],
    });
    const result = validateBlock(blocks[0]);
    expect(result.type).toBe("EvidenceBrief");
    if (result.type === "EvidenceBrief") {
      expect(result.gap).toBeNull();
      expect(result.nextSteps).toEqual([]);
      expect(result.evidence?.rows).toHaveLength(200);
    }
  });
});

describe("translateBackendStream", () => {
  const body = (text: string) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  it("maps steps to progress without agent names and skips repeats", async () => {
    const sse = (event: string, data: unknown) =>
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const events = [];
    for await (const event of translateBackendStream(
      body(
        sse("status", { step: "clasificando" }) +
          sse("status", { step: "clasificando" }) +
          sse("status", { step: "inventado" }) +
          sse("status", { step: "componiendo" }) +
          sse("ui", {
            summary: "s",
            brief_version: 1,
            ms: 1,
            components: [brief],
          }),
      ),
      "q",
    ))
      events.push(event);
    expect(events.map((e) => e.type)).toEqual([
      "progress",
      "progress",
      "ui-block",
      "done",
    ]);
    expect(JSON.stringify(events)).not.toMatch(/analyst|physics|synthesizer/);
  });
});

describe("humanized tables", () => {
  it("labels columns, with units and metric suffixes", () => {
    expect(columnLabel("o2_percent_promedio", "es")).toBe("O₂ promedio (%)");
    expect(columnLabel("pressure_kpa_min", "es")).toBe("Presión mín. (kPa)");
    expect(columnLabel("pressure_kpa_max", "es")).toBe("Presión máx. (kPa)");
    expect(columnLabel("gravity_environment", "es")).toBe("Gravedad");
    expect(columnLabel("spread_rate_mm_s", "es")).toBe("Propagación (mm/s)");
    expect(columnLabel("campo_nuevo_raro", "es")).toBe("Campo nuevo raro");
    expect(columnLabel("o2_percent_promedio")).toBe("O₂ avg. (%)");
    expect(columnLabel("pressure_kpa_min")).toBe("Pressure min. (kPa)");
  });

  it("translates values and rounds long decimals for display only", () => {
    expect(formatCell("gravity_environment", "microgravity", "es")).toBe(
      "Microgravedad",
    );
    expect(formatCell("gravity_environment", "microgravity")).toBe(
      "Microgravity",
    );
    expect(formatCell("outcome", "no_sustained_burn", "es")).toBe(
      "Se autoextinguió",
    );
    expect(formatCell("o2_basis", "oxidizer_stream", "es")).toBe(
      "Corriente de oxidante",
    );
    expect(formatCell("needs_review", true, "es")).toBe("Sí");
    expect(formatCell("needs_review", true)).toBe("Yes");
    expect(formatCell("material", null)).toBe("—");
    expect(formatCell("material", "PMMA (polímero)")).toBe("PMMA (polímero)");
    expect(formatCell("o2_percent_promedio", 21.0304)).toBe("21.03");
    expect(formatCell("x", 0.123456)).toBe("0.123");
    expect(formatNumber(17)).toBe("17");
    expect(formatNumber(22.1)).toBe("22.1");
  });

  it("sorts numbers by value, text in Spanish and nulls last in both directions", () => {
    const rows = [
      ["b", 10],
      ["a", 9],
      [null, null],
      ["ñ", 100],
    ];
    expect(sortRows(rows, 1, 1).map((r) => r[1])).toEqual([9, 10, 100, null]);
    expect(sortRows(rows, 1, -1).map((r) => r[1])).toEqual([100, 10, 9, null]);
    expect(sortRows(rows, 0, 1).map((r) => r[0])).toEqual([
      "a",
      "b",
      "ñ",
      null,
    ]);
  });

  it("picks the essential columns of a wide table", () => {
    const wide = [
      "experiment_id",
      "test_id",
      "point_type",
      "limit_type",
      "material",
      "material_class",
      "thickness_mm",
      "o2_percent",
      "o2_basis",
      "o2_status",
      "pressure_kpa",
      "gravity_environment",
      "outcome",
      "spread_rate_mm_s",
    ];
    const picked = compactColumns(wide).map((i) => wide[i]);
    expect(picked.length).toBeLessThanOrEqual(7);
    expect(picked).toContain("material");
    expect(picked).toContain("o2_percent");
    expect(compactColumns(["a", "b"])).toEqual([0, 1]);
    expect(
      compactColumns(Array.from({ length: 9 }, (_, i) => `c${i}`)),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("units and gap text", () => {
  it("converts kPa and psi", () => {
    expect(kpaToPsi(101.325)).toBeCloseTo(14.696, 2);
    expect(psiToKpa(1)).toBeCloseTo(6.89476, 5);
  });

  it("shows open bounds readable: 30.01 becomes > 30", () => {
    expect(formatRange(30.01, null, "%")).toBe("> 30 %");
    expect(formatRange(30, null, "%")).toBe("≥ 30 %");
    expect(formatRange(null, 29.99, "%")).toBe("< 30 %");
    expect(formatRange(20, 40, "%")).toBe("20–40 %");
    expect(formatRange(30.01, 50, "%", 1, "es")).toBe("> 30 y ≤ 50 %");
    expect(formatRange(30.01, 50, "%")).toBe("> 30 and ≤ 50 %");
    expect(formatRange(null, null, "%")).toBeNull();
  });

  const gap: BriefGap = {
    description: "d",
    pressureKpaMin: 34.47,
    pressureKpaMax: null,
    o2PercentMin: 30.01,
    o2PercentMax: null,
    gravity: "lunar",
  };
  it("lists pressure in kPa and psi", () => {
    expect(gapFacts(gap, "es")).toEqual([
      { label: "Oxígeno", value: "> 30 %" },
      { label: "Presión", value: "≥ 34.5 kPa · ≥ 5 psi" },
      { label: "Gravedad", value: "Gravedad lunar" },
    ]);
    expect(gapFacts(gap)).toEqual([
      { label: "Oxygen", value: "> 30 %" },
      { label: "Pressure", value: "≥ 34.5 kPa · ≥ 5 psi" },
      { label: "Gravity", value: "Lunar gravity" },
    ]);
  });

  it("builds the map region in psi and clamps to the map domain", () => {
    expect(gapRegion(gap)).toEqual({
      pressureMin: expect.closeTo(5, 2),
      pressureMax: 16,
      oxygenMin: 30.01,
      oxygenMax: 50,
    });
    expect(
      gapRegion({ ...gap, pressureKpaMin: null, o2PercentMin: null }),
    ).toBeNull();
    expect(
      gapRegion({ ...gap, pressureKpaMin: 5000, o2PercentMin: 80 }),
    ).toMatchObject({
      pressureMin: 16,
      oxygenMin: 50,
    });
  });

  it("maps gravity to the atlas; Mars has no counterpart", () => {
    expect(atlasGravity("microgravity")).toBe("micro");
    expect(atlasGravity("lunar")).toBe("lunar");
    expect(atlasGravity("normal")).toBe("earth");
    expect(atlasGravity("martian")).toBeNull();
    expect(atlasGravity(null)).toBeNull();
  });
});

describe("next steps", () => {
  const step = (over: Partial<BriefStep>): BriefStep => ({
    kind: "simulate",
    label: "l",
    pressureKpa: null,
    o2Percent: null,
    gravity: null,
    material: null,
    ...over,
  });
  it("maps a simulate step to lab conditions", () => {
    const { patch, summary, notes } = labParamsFromStep(
      step({
        pressureKpa: 68.95,
        o2Percent: 35,
        gravity: "microgravity",
        material: "pmma",
      }),
      ["Nomex", "PMMA (polímero)"],
      "es",
    );
    expect(patch).toEqual({
      pressure: 10,
      oxygen: 35,
      gravity: "micro",
      material: "PMMA (polímero)",
    });
    expect(summary).toBe(
      "Laboratorio con 10 psi · 35 % O₂ · µg · PMMA (polímero).",
    );
    expect(notes).toEqual([]);
    expect(labParamsFromStep(step({ o2Percent: 35 }), [], "en").summary).toBe(
      "Lab set to 35 % O₂.",
    );
  });
  it("maps lunar and normal gravity", () => {
    expect(labParamsFromStep(step({ gravity: "lunar" })).patch.gravity).toBe(
      "lunar",
    );
    expect(labParamsFromStep(step({ gravity: "normal" })).patch.gravity).toBe(
      "earth",
    );
  });
  it("explains what it could not apply instead of failing", () => {
    const { patch, notes } = labParamsFromStep(
      step({
        pressureKpa: 500,
        o2Percent: 10,
        gravity: "martian",
        material: "Titanio",
      }),
      ["PMMA"],
      "es",
    );
    expect(patch).toEqual({ pressure: 16, oxygen: 18 });
    expect(notes).toHaveLength(4);
    expect(notes.join(" ")).toMatch(/marciana/);
    expect(notes.join(" ")).toMatch(/Titanio/);
  });
  it("matches materials ignoring accents, case and the class suffix", () => {
    expect(matchMaterial("algodon", ["Algodón (tela)"])).toBe("Algodón (tela)");
    expect(matchMaterial("", ["PMMA"])).toBeNull();
    expect(matchMaterial("Kevlar", ["PMMA"])).toBeNull();
  });
  it("drafts an experiment proposal from the gap", () => {
    const proposal = experimentProposal(
      {
        description: "No hay ensayos con más de 30 % de O₂.",
        pressureKpaMin: null,
        pressureKpaMax: null,
        o2PercentMin: 30.01,
        o2PercentMax: null,
        gravity: null,
      },
      step({ kind: "propose_experiment", gravity: "lunar", material: "PMMA" }),
      "es",
    );
    expect(proposal.conditions).toEqual([
      "Oxígeno: > 30 %",
      "Gravedad: Gravedad lunar",
      "Material: PMMA",
    ]);
    expect(proposal.text).toContain("Qué medir");
    expect(proposal.text).toContain("- Oxígeno: > 30 %");
  });
});

describe("export", () => {
  it("writes raw columns and values as CSV with quoting", () => {
    const csv = evidenceCsv({
      columns: ["experiment_id", "material", "o2_percent_promedio"],
      rows: [
        ["PSI-1", 'PMMA, "negro"\nbarra', 21.0304],
        ["PSI-2", null, 22],
      ],
    });
    expect(csv).toBe(
      'experiment_id,material,o2_percent_promedio\r\nPSI-1,"PMMA, ""negro""\nbarra",21.0304\r\nPSI-2,,22',
    );
  });
  it("neutralizes spreadsheet formulas but keeps negative numbers", () => {
    const csv = evidenceCsv({
      columns: ["a"],
      rows: [["=HYPERLINK(1)"], ["+1"], ["-x"], [-5]],
    });
    expect(csv.split("\r\n").slice(1)).toEqual([
      "'=HYPERLINK(1)",
      "'+1",
      "'-x",
      "-5",
    ]);
  });
  it("builds an APA-like citation with ids, files and access date", () => {
    const text = citationText(
      {
        evidence: {
          title: "Ensayos consultados",
          columns: [],
          rows: [],
          experimentIds: ["PSI-26", "PSI-99"],
        },
        sourceFiles: ["a.pdf", "b.csv"],
      },
      new Date(Date.UTC(2026, 10, 15)),
      "es",
    );
    expect(text).toBe(
      "NASA Physical Sciences Informatics (PSI). (s. f.). Ensayos consultados. Consultado en Atlas del fuego lunar el 15 de noviembre de 2026. Experimentos: PSI-26, PSI-99. Archivos fuente: a.pdf; b.csv.",
    );
    expect(
      citationText(
        { evidence: null, sourceFiles: [] },
        new Date(Date.UTC(2026, 0, 1)),
        "es",
      ),
    ).toContain("1 de enero de 2026");
    expect(
      citationText(
        { evidence: null, sourceFiles: [] },
        new Date(Date.UTC(2026, 0, 1)),
      ),
    ).toContain("Retrieved from Lunar Fire Atlas on January 1, 2026");
  });
});

describe("lead and progress copy", () => {
  it("drops a summary that repeats the verdict or points at the table", () => {
    const verdict = "No hay ensayos de sólidos con más de 30 % de O₂.";
    expect(
      informativeLead(
        "No hay ensayos de sólidos con más de 30 % de O₂",
        verdict,
      ),
    ).toBeNull();
    expect(
      informativeLead("Las diferencias se ven en la tabla.", verdict),
    ).toBeNull();
    expect(informativeLead("", verdict)).toBeNull();
    expect(
      informativeLead(
        "Los 158 registros son de atmósferas cercanas al aire.",
        verdict,
      ),
    ).toMatch(/158/);
  });
  it("describes progress in user terms, never naming agents", () => {
    expect(progressCopy("consultando_datos", 708, "es")).toBe(
      "Consultando 708 ensayos",
    );
    expect(progressCopy("buscando_fuentes", undefined, "es")).toBe(
      "Leyendo los informes de NASA PSI",
    );
    expect(progressCopy("componiendo", undefined, "es")).toBe(
      "Redactando la ficha",
    );
    expect(progressCopy("consultando_datos", 708)).toBe("Querying 708 trials");
  });
});

describe("map overlays", () => {
  it("highlights by investigation and brings the map into view", () => {
    let state = atlasReducer(
      { ...initialState, view: "lab", tab: "copilot" },
      { type: "highlight", ids: ["PSI-26"] },
    );
    expect(state).toMatchObject({ view: "map", tab: "camera" });
    expect(state.overlays).toMatchObject({
      highlight: ["PSI-26"],
      focusPending: true,
    });
    state = atlasReducer(state, { type: "overlay-focused" });
    expect(state.overlays.focusPending).toBe(false);
    const gap = { label: "Hueco", region: null };
    state = atlasReducer(state, { type: "show-gap", gap });
    expect(state.overlays.gap).toEqual(gap);
    expect(state.overlays.highlight).toEqual(["PSI-26"]);
    state = atlasReducer(state, { type: "clear-overlays" });
    expect(state.overlays).toEqual({
      highlight: [],
      gap: null,
      focusPending: false,
    });
    const ids = new Set(["PSI-26"]);
    expect(isHighlighted({ id: "PSI-26/FP-1" }, ids)).toBe(true);
    expect(isHighlighted({ id: "PSI-260/FP-1" }, ids)).toBe(false);
    expect(isHighlighted({ id: "PSI-26" }, ids)).toBe(true);
  });
});
