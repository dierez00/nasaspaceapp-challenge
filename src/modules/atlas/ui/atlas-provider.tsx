"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { Experiment, Gravity } from "../domain/experiment";
import {
  emptyOverlays,
  type GapOverlay,
  type Overlays,
} from "../domain/overlays";
import type { Query } from "@/modules/copilot/domain/contracts";
export type AtlasState = {
  assistantOpen: boolean;
  selectedId: string | null;
  view: "lab" | "map";
  gravity: Gravity | "all";
  tab: "camera" | "copilot";
  pending: Query | null;
  overlays: Overlays;
};
export type AtlasAction =
  | { type: "assistant"; open: boolean }
  | { type: "select"; id: string }
  | { type: "gravity"; gravity: AtlasState["gravity"] }
  | { type: "tab"; tab: AtlasState["tab"] }
  | { type: "query"; query: Query }
  | { type: "clear-query" }
  | { type: "close" }
  | { type: "view"; view: "lab" | "map" }
  | { type: "highlight"; ids: string[] }
  | { type: "show-gap"; gap: GapOverlay }
  | { type: "clear-overlays" }
  | { type: "overlay-focused" };
export const initialState: AtlasState = {
  assistantOpen: false,
  selectedId: null,
  view: "lab",
  gravity: "all",
  tab: "camera",
  pending: null,
  overlays: emptyOverlays,
};
export function atlasReducer(
  state: AtlasState,
  action: AtlasAction,
): AtlasState {
  switch (action.type) {
    case "assistant":
      return {
        ...state,
        assistantOpen: action.open,
        tab: action.open ? "copilot" : "camera",
      };
    case "select":
      return {
        ...state,
        selectedId: action.id,
        tab: "camera",
        assistantOpen: false,
        view: "lab",
      };
    case "view":
      return { ...state, view: action.view };
    case "close":
      return { ...state, selectedId: null };
    case "gravity":
      return { ...state, gravity: action.gravity };
    case "tab":
      return {
        ...state,
        tab: action.tab,
        assistantOpen: action.tab === "copilot",
      };
    case "query":
      return {
        ...state,
        pending: action.query,
        tab: "copilot",
        assistantOpen: true,
      };
    case "clear-query":
      return { ...state, pending: null };
    // Overlays are asked for from the copilot: bring the map into view (and the
    // camera panel on narrow screens) so the request is visible.
    case "highlight":
      return {
        ...state,
        view: "map",
        tab: "camera",
        overlays: {
          ...state.overlays,
          highlight: action.ids,
          focusPending: true,
        },
      };
    case "show-gap":
      return {
        ...state,
        view: "map",
        tab: "camera",
        overlays: {
          ...state.overlays,
          gap: action.gap,
          focusPending: true,
        },
      };
    case "clear-overlays":
      return {
        ...state,
        overlays: emptyOverlays,
      };
    case "overlay-focused":
      return {
        ...state,
        overlays: { ...state.overlays, focusPending: false },
      };
  }
}
const Context = createContext<{
  state: AtlasState;
  dispatch: React.Dispatch<AtlasAction>;
  experiments: Experiment[];
  highlightExperiments: (ids: string[]) => void;
  showGap: (gap: GapOverlay) => void;
  clearOverlays: () => void;
} | null>(null);
export function AtlasProvider({
  experiments,
  children,
}: {
  experiments: Experiment[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(atlasReducer, initialState);
  const highlightExperiments = useCallback(
    (ids: string[]) => dispatch({ type: "highlight", ids }),
    [],
  );
  const showGap = useCallback(
    (gap: GapOverlay) => dispatch({ type: "show-gap", gap }),
    [],
  );
  const clearOverlays = useCallback(
    () => dispatch({ type: "clear-overlays" }),
    [],
  );
  const value = useMemo(
    () => ({
      state,
      dispatch,
      experiments,
      highlightExperiments,
      showGap,
      clearOverlays,
    }),
    [state, experiments, highlightExperiments, showGap, clearOverlays],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAtlas() {
  const context = useContext(Context);
  if (!context) throw new Error("AtlasProvider is required");
  return context;
}
