"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type gsap from "gsap";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { useReducedMotion } from "@/components/common/useReducedMotion";
import { HeroSection } from "@/components/hero/HeroSection";
import { ExperienceContext } from "@/shared/experience/experience-context";
import {
  buildDive,
  buildReturn,
  resetCabin,
  resetDeck,
  type DiveState,
} from "./dive-timeline";
import {
  experienceReducer,
  isTransitioning,
  selectSurface,
} from "./experience-phase";
import "./experience.css";

const DECK_HASH = "#dashboard";
// Ignore skip input right after the CTA so a double click does not swallow the dive.
const SKIP_GUARD_MS = 300;

/**
 * Owns the cabin <-> deck flow. Page scroll is locked (every layer is fixed), so the only
 * ways into the Atlas are the CTA, the skip link and the `#dashboard` deep link.
 */
export function ExperienceShell({ children }: { children: ReactNode }) {
  const [phase, dispatch] = useReducer(experienceReducer, "cabin");
  const [peak, setPeak] = useState(false);
  const reduced = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const dive = useRef<DiveState>({ p: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const phaseRef = useRef(phase);
  const startedAt = useRef(0);
  const prevPhase = useRef(phase);

  useLayoutEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const { deckLive, cabinLive } = selectSurface(phase, peak);

  const syncHash = useCallback((onDeck: boolean) => {
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", onDeck ? base + DECK_HASH : base);
  }, []);

  /** Ends the running transition (if any) at its final state. Safe to call twice. */
  const finishNow = useCallback(() => {
    const running = timeline.current;
    if (!running) return;
    timeline.current = null;
    running.progress(1);
    running.kill();
    // `progress()` may suppress onComplete; the reducer ignores a repeated finish.
    dispatch({ type: "finish" });
  }, []);

  const stopTimeline = useCallback(() => {
    timeline.current?.kill();
    timeline.current = null;
  }, []);

  const start = useCallback(() => {
    const root = rootRef.current;
    if (!root || phaseRef.current !== "cabin") return;
    startedAt.current = performance.now();
    setPeak(false);
    dispatch({ type: "start" });
    stopTimeline();
    const tl = buildDive(
      {
        root,
        dive: dive.current,
        onPeak: () => setPeak(true),
        onDone: () => {
          timeline.current = null;
          dispatch({ type: "finish" });
        },
      },
      reduced,
    );
    timeline.current = tl;
  }, [reduced, stopTimeline]);

  const jumpToDeck = useCallback(() => {
    stopTimeline();
    dispatch({ type: "jump" });
  }, [stopTimeline]);

  const returnToCabin = useCallback(() => {
    const root = rootRef.current;
    if (!root || phaseRef.current !== "deck") return;
    startedAt.current = performance.now();
    setPeak(true);
    stopTimeline();
    dispatch({ type: "back" });
    timeline.current = buildReturn(
      {
        root,
        dive: dive.current,
        onPeak: () => setPeak(false),
        onDone: () => {
          timeline.current = null;
          dispatch({ type: "finish" });
        },
      },
      reduced,
    );
  }, [reduced, stopTimeline]);

  // Deep link: `/#dashboard` opens straight on the deck, no dive.
  useLayoutEffect(() => {
    if (window.location.hash === DECK_HASH) jumpToDeck();
    const onHash = () => {
      if (window.location.hash === DECK_HASH && phaseRef.current === "cabin") {
        jumpToDeck();
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [jumpToDeck]);

  // Resting states, hash and focus once a phase settles.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = prevPhase.current;
    prevPhase.current = phase;
    if (phase === "deck") {
      resetDeck(root);
      syncHash(true);
      if (previous !== "deck") deckRef.current?.focus({ preventScroll: true });
    } else if (phase === "cabin" && previous !== "cabin") {
      resetCabin(root, dive.current);
      syncHash(false);
      if (previous === "returning") ctaRef.current?.focus({ preventScroll: true });
    }
  }, [phase, syncHash]);

  // Click, Esc or Enter jump a running transition to its end state.
  const transitioning = isTransitioning(phase);
  useEffect(() => {
    if (!transitioning) return;
    const skip = () => {
      if (performance.now() - startedAt.current < SKIP_GUARD_MS) return;
      finishNow();
    };
    // A pointer skip must not also click whatever sits under the finger on the deck.
    const skipPointer = () => {
      if (performance.now() - startedAt.current < SKIP_GUARD_MS) return;
      const swallow = (event: Event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(
        () => window.removeEventListener("click", swallow, { capture: true }),
        500,
      );
      finishNow();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        skip();
      }
    };
    window.addEventListener("pointerdown", skipPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", skipPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [transitioning, finishNow]);

  useEffect(
    () => () => {
      timeline.current?.kill();
    },
    [],
  );

  const context = useMemo(
    () => ({ deckLive, returnToCabin }),
    [deckLive, returnToCabin],
  );

  return (
    <ExperienceContext.Provider value={context}>
      <div ref={rootRef} className="experience" data-phase={phase}>
        <a
          href={DECK_HASH}
          className="skip-link"
          onClick={(event) => {
            event.preventDefault();
            jumpToDeck();
          }}
        >
          Saltar al Atlas
        </a>
        <LoadingScreen />

        <div
          className="experience-layer"
          inert={phase !== "cabin"}
          aria-hidden={phase !== "cabin" || undefined}
        >
          <HeroSection
            live={cabinLive}
            dive={dive}
            onStart={start}
            ctaRef={ctaRef}
          />
        </div>

        <div
          ref={deckRef}
          id="dashboard"
          data-layer="deck"
          tabIndex={-1}
          className="deck"
          inert={phase !== "deck"}
          aria-hidden={phase !== "deck" || undefined}
        >
          {children}
        </div>

        <div data-layer="bloom" className="bloom" aria-hidden="true" />
        <div data-layer="veil" className="veil" aria-hidden="true" />
      </div>
    </ExperienceContext.Provider>
  );
}
