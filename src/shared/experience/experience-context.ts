"use client";

import { createContext, useContext } from "react";

export interface ExperienceContextValue {
  /** True while the deck is the visible, interactive surface (lab may render). */
  deckLive: boolean;
  /** Return to the cabin (reverse transition). */
  returnToCabin: () => void;
}

// null outside the public shell (tests, other routes): consumers must default to "live".
export const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export function useExperience() {
  return useContext(ExperienceContext);
}
