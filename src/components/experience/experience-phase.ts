// Pure state machine for the cabin -> dive -> deck flow. No DOM, no timers: the
// shell owns animation and feeds the outcome back as events.
export type ExperiencePhase = "cabin" | "diving" | "deck" | "returning";

export type ExperienceEvent =
  /** The visitor pressed "Comenzar inmersión". */
  | { type: "start" }
  /** The running transition reached its end state (naturally or skipped). */
  | { type: "finish" }
  /** The visitor asked to go back to the cabin. */
  | { type: "back" }
  /** Jump straight to the deck: skip link, deep link, hash change. */
  | { type: "jump" };

export function experienceReducer(
  phase: ExperiencePhase,
  event: ExperienceEvent,
): ExperiencePhase {
  switch (event.type) {
    case "start":
      return phase === "cabin" ? "diving" : phase;
    case "finish":
      if (phase === "diving") return "deck";
      if (phase === "returning") return "cabin";
      return phase;
    case "back":
      return phase === "deck" ? "returning" : phase;
    case "jump":
      return "deck";
  }
}

/** A transition is running and a click, Esc or Enter may jump to its end. */
export function isTransitioning(phase: ExperiencePhase) {
  return phase === "diving" || phase === "returning";
}

/**
 * The deck owns rendering (lab clock and WebGL) only once it is the visible
 * surface; the cabin owns it otherwise. `peak` marks the whiteout midpoint of a
 * transition, the one moment where handing the GPU over is invisible.
 */
export function selectSurface(phase: ExperiencePhase, peak: boolean) {
  const deckLive = phase === "deck" || (isTransitioning(phase) && peak);
  return { deckLive, cabinLive: !deckLive };
}
