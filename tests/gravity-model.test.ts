import { describe, expect, it } from "vitest";
import { demoExperiments } from "@/modules/atlas/infra/experiments";
import type { Experiment } from "@/modules/atlas/domain/experiment";
import {
  createSimulationState,
  fromExperiment,
  simulationReducer,
} from "@/modules/simulation/domain/scenario";
import { nearestTrials, sameMaterial } from "@/modules/simulation/domain/comparison";
import {
  gravityProfile,
  physicsCallout,
  physicsMoment,
  thresholdOutlook,
} from "@/modules/simulation/domain/gravity-model";

const base = fromExperiment(demoExperiments[0]); // PMMA 8.2 psi 32 % O2
function observed(patch: Partial<Experiment>): Experiment {
  return {
    ...demoExperiments[0],
    id: "PSI-1/FP-1",
    provenance: "verified",
    sources: [{ ...demoExperiments[0].sources[0], demo: false }],
    ...patch,
  };
}

describe("gravity profile", () => {
  it("separates shape, transport and color by gravity", () => {
    const micro = gravityProfile("micro", base);
    const lunar = gravityProfile("lunar", base);
    const earth = gravityProfile("earth", base);
    expect([micro.shape, lunar.shape, earth.shape]).toEqual([
      "esférica",
      "lágrima",
      "alargada",
    ]);
    expect([micro.transport, lunar.transport, earth.transport]).toEqual([
      "difusión",
      "mixto",
      "flotación",
    ]);
    expect(micro.colorCue).toBe("Azul tenue");
    expect(earth.colorCue).toBe("Amarillo brillante");
    expect(micro.relativeBrightness).toBeLessThan(lunar.relativeBrightness);
    expect(lunar.relativeBrightness).toBeLessThan(earth.relativeBrightness);
  });
  it("keeps brightness relative and bounded", () => {
    for (const oxygen of [18, 50])
      expect(gravityProfile("earth", { oxygen }).relativeBrightness).toBeLessThanOrEqual(1);
  });
});

describe("threshold outlook", () => {
  it("uses real trials within tolerance and reports their outcome", () => {
    const near = observed({ outcome: "extinction", pressure: 8.4, oxygen: 32.5 });
    const result = thresholdOutlook([near], base, "micro");
    expect(result).toMatchObject({ outlook: "se apaga", basis: "observed" });
    expect(result.trials).toEqual([near]);
  });
  it("is uncertain when nearby trials disagree or are undetermined", () => {
    const mixed = [
      observed({ id: "PSI-2/FP-1", outcome: "ignition" }),
      observed({ id: "PSI-3/FP-1", outcome: "extinction" }),
    ];
    expect(thresholdOutlook(mixed, base, "micro").outlook).toBe("incierto");
    expect(
      thresholdOutlook([observed({ outcome: "unknown" })], base, "micro").outlook,
    ).toBe("incierto");
  });
  it("labels the fallback as an illustrative prediction", () => {
    const far = observed({ pressure: 1, oxygen: 20 });
    const result = thresholdOutlook([far, ...demoExperiments], base, "micro");
    expect(result.basis).toBe("illustrative");
    expect(result.label).toBe("Sin ensayos: predicción ilustrativa");
    expect(result.trials).toEqual([]);
    expect(thresholdOutlook([], { ...base, pressure: 1, oxygen: 20 }, "earth").outlook).toBe("se apaga");
    expect(thresholdOutlook([], { ...base, pressure: 14.7, oxygen: 21 }, "earth").outlook).toBe("se sostiene");
  });
  it("never invents combustion in vacuum", () => {
    expect(thresholdOutlook([], { ...base, pressure: 0 }, "micro").outlook).toBe("sin gas");
  });
});

describe("physics callouts", () => {
  it("shows one moment at a time along the 8 s loop", () => {
    expect(physicsMoment(0, "ignition")).toBe("ignition");
    expect(physicsMoment(3, "ignition")).toBe("growth");
    expect(physicsMoment(7, "propagation")).toBe("steady");
    expect(physicsMoment(7, "extinction")).toBe("extinction");
    expect(physicsCallout(3, "ignition").text).toContain("difusión");
  });
});

describe("simulate next step", () => {
  it("sets shared conditions, opens the three-gravity view and emphasizes the named gravity", () => {
    const state = simulationReducer(createSimulationState(demoExperiments[0]), {
      type: "simulate",
      patch: { pressure: 10, oxygen: 35, gravity: "lunar", material: "Nomex" },
    });
    expect(state.threeGravities).toBe(true);
    expect(state.compare).toBe(false);
    expect(state.focusGravity).toBe("lunar");
    expect(state.scenarios.A).toMatchObject({ pressure: 10, oxygen: 35, material: "Nomex" });
  });
  it("leaves every column neutral when no gravity is named and clamps ranges", () => {
    const state = simulationReducer(createSimulationState(), {
      type: "simulate",
      patch: { pressure: 99, oxygen: 35 },
    });
    expect(state.focusGravity).toBeNull();
    expect(state.scenarios.A.pressure).toBe(16);
  });
  it("A/B and the three-gravity view are mutually exclusive", () => {
    let state = simulationReducer(createSimulationState(), { type: "three", on: true });
    state = simulationReducer(state, { type: "compare" });
    expect(state.threeGravities).toBe(false);
    state = simulationReducer(state, { type: "three", on: true });
    expect(state.compare).toBe(false);
  });
});

describe("nearest real trials", () => {
  it("matches the material family but not other materials", () => {
    expect(sameMaterial("PMMA", "PMMA film (polímero)")).toBe(true);
    expect(sameMaterial("PMMA (polímero)", "PMMA")).toBe(true);
    expect(sameMaterial("PMMA", "Nomex III (natural) (tela)")).toBe(false);
    expect(sameMaterial("Nomex", "Nomex-III (natural) (tela)")).toBe(false);
  });
  it("returns up to three ranked trials per gravity", () => {
    const rows = [1, 2, 3, 4].map((n) =>
      observed({ id: `PSI-${n}/S1`, material: "PMMA film (polímero)", pressure: 8.2 + n }),
    );
    expect(nearestTrials(rows, base, "micro", 3).map((r) => r.id)).toEqual([
      "PSI-1/S1",
      "PSI-2/S1",
      "PSI-3/S1",
    ]);
  });
});
