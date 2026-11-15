import { describe, expect, it } from "vitest";
import {
  createSimulationState,
  simulationReducer,
  flameEnvelope,
} from "@/modules/simulation/domain/scenario";
import { SimulationClock } from "@/modules/simulation/application/clock";
import { demoExperiments } from "@/modules/atlas/infra/experiments";

describe("simulation scenarios", () => {
  it("duplicates A into independent B without mutating evidence", () => {
    const before = JSON.stringify(demoExperiments[0]);
    const original = createSimulationState(demoExperiments[0]);
    const compared = simulationReducer(original, { type: "compare" });
    expect(compared.scenarios.B).toEqual(compared.scenarios.A);
    const edited = simulationReducer(compared, {
      type: "edit",
      slot: "B",
      patch: { oxygen: 45, pressure: 4, gravity: "earth" },
    });
    expect(edited.scenarios.A.oxygen).toBe(32);
    expect(edited.scenarios.B.oxygen).toBe(45);
    expect(edited.scenarios.B.provenance).toBe("hypothetical");
    expect(edited.scenarios.B.original.oxygen).toBe(32);
    expect(JSON.stringify(demoExperiments[0])).toBe(before);
  });
  it("swaps complete scenarios and restores each evidence baseline", () => {
    let state = simulationReducer(createSimulationState(), {
      type: "load",
      experiments: [demoExperiments[0], demoExperiments[3]],
    });
    expect(state.compare).toBe(true);
    state = simulationReducer(state, {
      type: "edit",
      slot: "A",
      patch: { material: "Nomex", flameState: "extinction" },
    });
    state = simulationReducer(state, { type: "swap" });
    expect(state.scenarios.B.material).toBe("Nomex");
    state = simulationReducer(state, { type: "restore", slot: "B" });
    expect(state.scenarios.B.material).toBe("PMMA");
    expect(state.scenarios.B.experimentId).toBe("DEMO-001");
    expect(state.scenarios.B.provenance).toBe("original");
  });
  it("clamps controls, rejects NaN and never changes state based on conditions", () => {
    const state = simulationReducer(createSimulationState(), {
      type: "edit",
      slot: "A",
      patch: { pressure: -5, oxygen: 90, flameState: "propagation" },
    });
    expect(state.scenarios.A.pressure).toBe(0);
    expect(state.scenarios.A.oxygen).toBe(50);
    expect(state.scenarios.A.flameState).toBe("propagation");
    const invalid = simulationReducer(state, {
      type: "edit",
      slot: "A",
      patch: { pressure: NaN },
    });
    expect(invalid.scenarios.A.pressure).toBe(0);
  });
  it("keeps phases explicit and never renders a flame in vacuum", () => {
    for (const phase of ["ignition", "propagation", "extinction"] as const)
      expect(flameEnvelope(phase, 4, 0)).toBe(0);
    expect(flameEnvelope("ignition", 0, 8)).toBe(0);
    expect(flameEnvelope("ignition", 8, 8)).toBe(1);
    expect(flameEnvelope("extinction", 0, 8)).toBe(1);
    expect(flameEnvelope("extinction", 8, 8)).toBe(0);
  });
});
describe("shared eight-second clock", () => {
  it("loops every eight seconds while preserving pause, seek and restart", () => {
    const clock = new SimulationClock();
    clock.play();
    for (let i = 0; i < 20; i++) clock.step(0.1);
    expect(clock.time).toBeCloseTo(2);
    clock.pause();
    clock.step(0.1);
    expect(clock.time).toBeCloseTo(2);
    clock.seek(7.95);
    clock.play();
    clock.step(0.1);
    expect(clock.time).toBeCloseTo(0.05);
    expect(clock.getSnapshot().time).toBeCloseTo(0.05);
    expect(clock.playing).toBe(true);
    for (let i = 0; i < 160; i++) clock.step(0.1);
    expect(clock.time).toBeCloseTo(0.05);
    expect(clock.playing).toBe(true);
    clock.pause();
    clock.step(0.1);
    expect(clock.time).toBeCloseTo(0.05);
    clock.seek(8);
    expect(clock.time).toBe(8);
    expect(clock.playing).toBe(false);
    clock.play();
    expect(clock.time).toBe(0);
    clock.restart(false);
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(false);
  });
  it("ignores hidden time by limiting frame gaps and publishes below frame frequency", () => {
    const clock = new SimulationClock();
    let count = 0;
    const unsubscribe = clock.subscribe(() => count++);
    clock.play();
    for (let i = 0; i < 60; i++) clock.step(1 / 60);
    expect(count).toBeLessThan(15);
    const previous = clock.time;
    clock.step(60);
    expect(clock.time - previous).toBeCloseTo(0.1);
    unsubscribe();
  });
});
