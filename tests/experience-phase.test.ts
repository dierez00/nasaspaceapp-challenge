import { describe, expect, it } from "vitest";
import {
  experienceReducer,
  isTransitioning,
  selectSurface,
  type ExperienceEvent,
  type ExperiencePhase,
} from "@/components/experience/experience-phase";

const run = (start: ExperiencePhase, ...events: ExperienceEvent["type"][]) =>
  events.reduce<ExperiencePhase>(
    (phase, type) => experienceReducer(phase, { type }),
    start,
  );

describe("experience phase machine", () => {
  it("starts the dive only from the cabin and lands on the deck", () => {
    expect(run("cabin", "start")).toBe("diving");
    expect(run("cabin", "start", "finish")).toBe("deck");
    expect(run("deck", "start")).toBe("deck");
    expect(run("returning", "start")).toBe("returning");
  });

  it("returns to the cabin only from the deck", () => {
    expect(run("deck", "back")).toBe("returning");
    expect(run("deck", "back", "finish")).toBe("cabin");
    expect(run("cabin", "back")).toBe("cabin");
    expect(run("diving", "back")).toBe("diving");
  });

  it("jump reaches the deck from every phase", () => {
    for (const phase of ["cabin", "diving", "deck", "returning"] as const) {
      expect(run(phase, "jump")).toBe("deck");
    }
  });

  it("ignores finish when nothing is transitioning, so skip is idempotent", () => {
    expect(run("cabin", "finish")).toBe("cabin");
    expect(run("deck", "finish")).toBe("deck");
    expect(run("cabin", "start", "finish", "finish")).toBe("deck");
  });

  it("flags only the dive and the return as skippable transitions", () => {
    expect(isTransitioning("diving")).toBe(true);
    expect(isTransitioning("returning")).toBe(true);
    expect(isTransitioning("cabin")).toBe(false);
    expect(isTransitioning("deck")).toBe(false);
  });

  it("hands rendering to exactly one surface, switching at the crossfade midpoint", () => {
    expect(selectSurface("cabin", false)).toEqual({
      deckLive: false,
      cabinLive: true,
    });
    expect(selectSurface("diving", false)).toEqual({
      deckLive: false,
      cabinLive: true,
    });
    expect(selectSurface("diving", true)).toEqual({
      deckLive: true,
      cabinLive: false,
    });
    expect(selectSurface("deck", false)).toEqual({
      deckLive: true,
      cabinLive: false,
    });
    expect(selectSurface("returning", true)).toEqual({
      deckLive: true,
      cabinLive: false,
    });
    expect(selectSurface("returning", false)).toEqual({
      deckLive: false,
      cabinLive: true,
    });
  });
});
