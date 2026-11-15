import { useSyncExternalStore } from "react";
import { audiences, type Audience } from "../domain/brief";

const KEY = "atlas:audience";
const listeners = new Set<() => void>();
let current: Audience | null = null;

function read(): Audience {
  if (current) return current;
  try {
    const stored = window.localStorage.getItem(KEY);
    const found = audiences.find((audience) => audience === stored);
    if (found) current = found;
  } catch {
    // Storage can be blocked (private mode, site data cleared): keep the default.
  }
  return current ?? "student";
}

export function setAudience(audience: Audience) {
  current = audience;
  try {
    window.localStorage.setItem(KEY, audience);
  } catch {
    // Not persisted; the choice still holds for this session.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The audience lens, shared by every brief in the log and remembered across visits. */
export function useAudience() {
  return useSyncExternalStore<Audience>(subscribe, read, () => "student");
}
