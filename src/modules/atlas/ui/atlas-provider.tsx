"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { Experiment, Gravity } from "../domain/experiment";
import type { Query } from "@/modules/copilot/domain/contracts";
export type AtlasState = {
  selectedId: string | null;
  view: "lab" | "map";
  gravity: Gravity | "all";
  tab: "camera" | "copilot";
  pending: Query | null;
};
export type AtlasAction =
  | { type: "select"; id: string }
  | { type: "gravity"; gravity: AtlasState["gravity"] }
  | { type: "tab"; tab: AtlasState["tab"] }
  | { type: "query"; query: Query }
  | { type: "clear-query" }
  | { type: "close" }
  | { type: "view"; view: "lab" | "map" };
export const initialState: AtlasState = {
  selectedId: null,
  view: "lab",
  gravity: "all",
  tab: "camera",
  pending: null,
};
export function atlasReducer(
  state: AtlasState,
  action: AtlasAction,
): AtlasState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id, tab: "camera", view: "lab" };
    case "view":
      return { ...state, view: action.view };
    case "close":
      return { ...state, selectedId: null };
    case "gravity":
      return { ...state, gravity: action.gravity };
    case "tab":
      return { ...state, tab: action.tab };
    case "query":
      return { ...state, pending: action.query, tab: "copilot" };
    case "clear-query":
      return { ...state, pending: null };
  }
}
const Context = createContext<{
  state: AtlasState;
  dispatch: React.Dispatch<AtlasAction>;
  experiments: Experiment[];
} | null>(null);
export function AtlasProvider({
  experiments,
  children,
}: {
  experiments: Experiment[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(atlasReducer, initialState);
  return (
    <Context.Provider value={{ state, dispatch, experiments }}>
      {children}
    </Context.Provider>
  );
}
export function useAtlas() {
  const context = useContext(Context);
  if (!context) throw new Error("AtlasProvider requerido");
  return context;
}
