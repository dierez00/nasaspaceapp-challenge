"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import type { Experiment } from "@/modules/atlas/domain/experiment";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { useExperience } from "@/shared/experience/experience-context";
import {
  createSimulationState,
  simulationReducer,
  type Conditions,
  type Slot,
  type SimulationState,
  type SimulationAction,
} from "../domain/scenario";
import { SimulationClock } from "./clock";
const Context = createContext<{
  state: SimulationState;
  dispatch: React.Dispatch<SimulationAction>;
  clock: SimulationClock;
  reduced: boolean;
  active: boolean;
  edit: (slot: Slot, patch: Partial<Conditions>) => void;
  load: (experiments: Experiment[]) => void;
  simulate: (patch: Partial<Conditions>) => void;
} | null>(null);
export function SimulationProvider({
  children,
  initialExperiment,
}: {
  children: ReactNode;
  initialExperiment?: Experiment;
}) {
  const { state: atlas, dispatch: atlasDispatch } = useAtlas();
  const [state, dispatch] = useReducer(
    simulationReducer,
    initialExperiment,
    createSimulationState,
  );
  const [clock] = useState(() => new SimulationClock());
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = matchMedia("(max-width: 1023px)");
    const updateMotion = () => {
      setReduced(motion.matches);
      if (motion.matches) clock.pause();
    };
    const updateViewport = () => setMobile(viewport.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateViewport();
    updateVisibility();
    if (!motion.matches) clock.play();
    motion.addEventListener("change", updateMotion);
    viewport.addEventListener("change", updateViewport);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      motion.removeEventListener("change", updateMotion);
      viewport.removeEventListener("change", updateViewport);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [clock]);
  // Pause the lab clock and render while the dashboard is scrolled out of the viewport.
  useEffect(() => {
    const target =
      document.getElementById("dashboard") ?? document.querySelector(".atlas-app");
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[entries.length - 1].isIntersecting),
      { rootMargin: "100px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  // Outside the public shell there is no cabin, so the deck is always live.
  const deckLive = useExperience()?.deckLive ?? true;
  const active =
    visible &&
    inView &&
    deckLive &&
    atlas.view === "lab" && (!mobile || atlas.tab === "camera");
  const snapshot = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getSnapshot,
  );
  useEffect(() => {
    if (!active || !snapshot.playing) return;
    let handle = 0;
    let last = performance.now();
    function tick(now: number) {
      clock.step((now - last) / 1000);
      last = now;
      if (clock.playing) handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [active, snapshot.playing, clock]);
  const edit = useCallback(
    (slot: Slot, patch: Partial<Conditions>) => {
      dispatch({ type: "edit", slot, patch });
      if (patch.flameState) clock.restart(!reduced);
    },
    [clock, reduced],
  );
  const load = useCallback(
    (experiments: Experiment[]) => {
      if (!experiments.length) return;
      dispatch({ type: "load", experiments });
      clock.restart(!reduced);
      atlasDispatch({ type: "select", id: experiments[0].id });
    },
    [atlasDispatch, clock, reduced],
  );
  const simulate = useCallback(
    (patch: Partial<Conditions>) => {
      dispatch({ type: "simulate", patch });
      clock.restart(!reduced);
    },
    [clock, reduced],
  );
  return (
    <Context.Provider
      value={{ state, dispatch, clock, reduced, active, edit, load, simulate }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSimulation() {
  const value = useContext(Context);
  if (!value) throw new Error("SimulationProvider is required");
  return value;
}
export function usePlayback() {
  const { clock } = useSimulation();
  return useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getSnapshot,
  );
}
