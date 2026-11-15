import { describe, expect, it } from "vitest";
import {
  experimentSchema,
  groupCoordinates,
  isLunarZone,
} from "@/modules/atlas/domain/experiment";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import { validateBlock, querySchema } from "@/modules/copilot/domain/contracts";
import { DemoCopilotGateway } from "@/modules/copilot/infra/demo-gateway";
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
