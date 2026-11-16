"use client";

import { useSyncExternalStore } from "react";

/**
 * The Atlas (`#dashboard`) sits under the hero. It is "settled" once its top reaches the
 * viewport top: only then do its own wheel gestures (3D zoom, inner panels) take over.
 * Without a hero above it (other routes, tests) it is always settled.
 */
export function isDeckSettled() {
  const deck = document.getElementById("dashboard");
  if (!deck) return true;
  return deck.getBoundingClientRect().top <= 2;
}

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function useDeckSettled() {
  return useSyncExternalStore(subscribe, isDeckSettled, () => true);
}
