import { describe, expect, it } from "vitest";
import {
  experimentSchema,
  groupCoordinates,
  isLunarZone,
} from "@/modules/atlas/domain/experiment";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import {
  isSolidMaterial,
  toAtlasExperiments,
} from "@/modules/atlas/infra/psi-api";
import { validateBlock, querySchema } from "@/modules/copilot/domain/contracts";
import { DemoCopilotGateway } from "@/modules/copilot/infra/demo-gateway";
import {
  backendQuestion,
  translateBackendStream,
} from "@/modules/copilot/infra/backend-query";
import {
  HttpCopilotGateway,
  parseSSE,
} from "@/modules/copilot/infra/http-gateway";
import { atlasReducer, initialState } from "@/modules/atlas/ui/atlas-provider";
import { vi } from "vitest";

const query = {
  version: 1 as const,
  queryId: "test",
  text: "Comparar µg vs 1g",
};
function stream(parts: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      parts.forEach((part) =>
        controller.enqueue(new TextEncoder().encode(part)),
      );
      controller.close();
    },
  });
}
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
describe("atlas domain", () => {
  it("validates fixtures and preserves unknown values", () => {
    expect(experimentSchema.array().parse(demoExperiments)).toHaveLength(12);
    expect(demoExperiments.some((e) => e.spreadRate === null)).toBe(true);
    expect(
      experimentSchema.safeParse({ ...demoExperiments[0], oxygen: 51 }).success,
    ).toBe(false);
  });
  it("includes exact lunar boundaries and rejects outside coordinates", () => {
    expect(isLunarZone(10.2, 30)).toBe(true);
    expect(isLunarZone(0, 50)).toBe(true);
    for (const [pressure, oxygen] of [
      [10.21, 30],
      [10, 29.99],
      [-1, 35],
      [8, 51],
    ])
      expect(isLunarZone(pressure, oxygen)).toBe(false);
  });
  it("groups collocated experiments without changing coordinates", () => {
    const group = groupCoordinates(demoExperiments).find(
      (group) => group.length > 1,
    )!;
    expect(group.map((e) => e.id)).toEqual(["DEMO-002", "DEMO-003"]);
    expect(group[0].pressure).toBe(group[1].pressure);
  });
  it("maintains selection through gravity and tab changes", () => {
    const selected = atlasReducer(initialState, {
      type: "select",
      id: "DEMO-001",
    });
    const filtered = atlasReducer(selected, {
      type: "gravity",
      gravity: "lunar",
    });
    expect(filtered.selectedId).toBe("DEMO-001");
    expect(
      atlasReducer(filtered, { type: "tab", tab: "copilot" }).selectedId,
    ).toBe("DEMO-001");
  });
});
describe("copilot contracts", () => {
  it("rejects invalid queries and falls back independently per block", () => {
    expect(querySchema.safeParse({ ...query, text: " " }).success).toBe(false);
    expect(
      querySchema.safeParse({
        ...query,
        context: { pressure: 20, oxygen: 30, gravity: "lunar" },
      }).success,
    ).toBe(false);
    const values = [
      { type: "ExperimentCard", experimentId: "DEMO-001" },
      { type: "BadCard" },
      { type: "SourceList", sources: [] },
    ].map(validateBlock);
    const fallback = validateBlock({
      type: "BadCard",
      sources: [...demoExperiments[0].sources, { bad: true }],
    });
    expect(fallback.type === "FallbackCard" && fallback.sources).toEqual(
      demoExperiments[0].sources,
    );
    expect(values.map((v) => v.type)).toEqual([
      "ExperimentCard",
      "FallbackCard",
      "SourceList",
    ]);
  });
  it("completes all guided queries and explains the demo limit", async () => {
    for (const text of [
      "Sólidos > 30% O₂",
      "Comparar µg vs 1g",
      "Análogos E-FIELD",
      "Hola",
    ]) {
      const events = [];
      for await (const event of new DemoCopilotGateway().query({
        ...query,
        text,
      }))
        events.push(event);
      expect(events.at(-1)?.type).toBe("done");
      expect(
        events.filter((event) => event.type === "text-delta"),
      ).toHaveLength(1);
      if (text !== "Hola")
        expect(events.some((event) => event.type === "ui-block")).toBe(true);
    }
  });
});
describe("SSE transport", () => {
  it("parses split frames, CRLF, comments and UTF-8 bytes", async () => {
    const raw = new TextEncoder().encode(
      ': keepalive\r\n\r\nevent: text-delta\r\ndata: {"type":"text-delta","queryId":"test","text":"µg 🔥"}\r\n\r\n',
    );
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of raw) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    const events = [];
    for await (const event of parseSSE(input)) events.push(event);
    expect(events).toEqual([
      { type: "text-delta", queryId: "test", text: "µg 🔥" },
    ]);
  });
  it("rejects malformed and incomplete frames", async () => {
    for (const input of ["data: nope\n\n", 'data: {"type":"done"']) {
      await expect(async () => {
        for await (const event of parseSSE(stream([input]))) void event;
      }).rejects.toThrow();
    }
  });
  it("ignores obsolete query ids and requires an explicit completion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(
        stream([
          frame({ type: "done", queryId: "old" }),
          frame({ type: "done", queryId: "test" }),
        ]),
      ),
    );
    const events = [];
    for await (const event of new HttpCopilotGateway().query(query))
      events.push(event);
    expect(events).toEqual([{ type: "done", queryId: "test" }]);
    fetchMock.mockResolvedValueOnce(
      new Response(
        stream([
          frame({ type: "text-delta", queryId: "test", text: "partial" }),
        ]),
      ),
    );
    await expect(async () => {
      for await (const event of new HttpCopilotGateway().query(query))
        void event;
    }).rejects.toThrow("antes de completar");
    fetchMock.mockRestore();
  });
  it("surfaces server errors and aborts a stalled read", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          stream([
            frame({ type: "error", queryId: "test", message: "Sin evidencia" }),
          ]),
        ),
      );
    await expect(async () => {
      for await (const event of new HttpCopilotGateway().query(query))
        void event;
    }).rejects.toThrow("Sin evidencia");
    fetchMock.mockRestore();
    const controller = new AbortController();
    const task = (async () => {
      for await (const event of parseSSE(
        new ReadableStream(),
        controller.signal,
      ))
        void event;
    })();
    controller.abort();
    await expect(task).rejects.toThrow();
  });
});

describe("NASA PSI adapter", () => {
  const test = (overrides: Record<string, unknown>) => ({
    test_id: "T1",
    material: "Nomex",
    material_class: "fabric",
    o2_percent: 21,
    pressure_kpa: 101.3,
    gravity_environment: "microgravity",
    outcome: "complete_burn",
    spread_rate_mm_s: 1.5,
    notes: "Nota de la fuente",
    source: { file: "PSI-1.csv", locator: "row 1" },
    ...overrides,
  });
  const record = {
    id: "PSI-1",
    title: "Prueba",
    acronym: "TEST",
    source_url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-1",
    tests: [
      test({}),
      test({
        test_id: "T2",
        material: "Etano",
        material_class: "gas",
        o2_percent: 34,
        pressure_kpa: 56.5,
        outcome: "no_sustained_burn",
      }),
      test({ test_id: "T3", pressure_kpa: 220 }),
      test({ test_id: "T4", o2_percent: 85 }),
    ],
  };

  it("maps backend points to the map contract and skips out-of-domain ones", () => {
    const { experiments, omitted } = toAtlasExperiments([record]);
    expect(omitted).toBe(2);
    expect(experimentSchema.array().parse(experiments)).toHaveLength(2);
    expect(experiments[0]).toMatchObject({
      id: "PSI-1/T1",
      material: "Nomex (tela)",
      pressure: 14.7,
      oxygen: 21,
      gravity: "micro",
      outcome: "ignition",
      provenance: "verified",
    });
    expect(experiments[1]).toMatchObject({
      pressure: 8.2,
      outcome: "extinction",
    });
    expect(isSolidMaterial(experiments[0])).toBe(true);
    expect(isSolidMaterial(experiments[1])).toBe(false);
    expect(experiments[0].sources[0]).toMatchObject({
      code: "PSI-1 T1",
      section: "row 1",
      demo: false,
    });
  });

  it("answers guided queries from the PSI catalog", async () => {
    const { experiments } = toAtlasExperiments([record]);
    const gateway = new DemoCopilotGateway(experiments, "psi");
    const text = [];
    const blocks = [];
    for await (const event of gateway.query({
      ...query,
      text: "Sólidos > 30% O₂",
    })) {
      if (event.type === "text-delta") text.push(event.text);
      if (event.type === "ui-block") blocks.push(event.block);
    }
    expect(text.join("")).toContain("Ninguna prueba con sólidos");
    expect(blocks).toContainEqual({
      type: "ExperimentCard",
      experimentId: "PSI-1/T2",
    });
  });
});

describe("FastAPI /query translation", () => {
  const sse = (event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const catalog = [
    {
      ...demoExperiments[0],
      id: "PSI-99/1-1",
      provenance: "verified" as const,
    },
  ];

  it("turns status, ui and components into copilot events", async () => {
    const body = stream([
      sse("status", { step: "clasificando" }),
      sse("status", { step: "buscando_fuentes" }),
      sse("ui", {
        summary: "Resumen",
        ms: 3,
        components: [
          { type: "text", body: "Detalle" },
          {
            type: "table",
            title: "Ensayos",
            columns: ["id", "o2"],
            rows: [["PSI-99", 21]],
          },
          {
            type: "gap_map",
            title: "Huecos",
            experiment_ids: ["PSI-99"],
            gravity_environment: "lunar",
            note: null,
          },
          {
            type: "citations",
            items: [
              {
                experiment_id: "PSI-99",
                source_file: "a.pdf",
                section: null,
                quote: "cita",
              },
            ],
          },
          { type: "notice", level: "warning", message: "Datos assumed" },
          { type: "desconocido" },
        ],
      }),
    ]);
    const events = [];
    for await (const event of translateBackendStream(body, "q1", catalog))
      events.push(event);
    expect(events.map((e) => e.type)).toEqual([
      "agent-status",
      "agent-status",
      "agent-status",
      "agent-status",
      "text-delta",
      "ui-block",
      "ui-block",
      "ui-block",
      "ui-block",
      "ui-block",
      "done",
    ]);
    expect(events[4]).toMatchObject({ text: "Resumen\n\nDetalle" });
    const blocks = events.flatMap((e) =>
      e.type === "ui-block" ? [validateBlock(e.block)] : [],
    );
    expect(blocks.map((b) => b.type)).toEqual([
      "FallbackCard",
      "GravityBounds",
      "ExperimentCard",
      "SourceList",
      "FallbackCard",
    ]);
    expect(blocks[2]).toEqual({
      type: "ExperimentCard",
      experimentId: "PSI-99/1-1",
    });
  });

  it("forwards backend errors and early closes", async () => {
    const failed = [];
    for await (const e of translateBackendStream(
      stream([sse("error", { message: "falló" })]),
      "q",
      catalog,
    ))
      failed.push(e);
    expect(failed).toEqual([{ type: "error", queryId: "q", message: "falló" }]);
    const cut = [];
    for await (const e of translateBackendStream(
      stream([sse("status", { step: "componiendo" })]),
      "q",
      catalog,
    ))
      cut.push(e);
    expect(cut.at(-1)?.type).toBe("error");
  });

  it("adds the map probe to the backend question", () => {
    expect(
      backendQuestion({
        ...query,
        text: "¿Arde?",
        context: { pressure: 8.2, oxygen: 34, gravity: "lunar" },
      }).q,
    ).toBe("¿Arde? (punto del mapa: 8.2 psi, 34.0% O₂, gravedad lunar)");
  });
});
