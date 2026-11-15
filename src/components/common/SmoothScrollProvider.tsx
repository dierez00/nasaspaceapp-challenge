"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Asegurar registro de ScrollTrigger en entorno cliente
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface SmoothScrollContextValue {
  getLenis: () => Lenis | null;
  scrollTo: (
    target: string | HTMLElement | number,
    options?: { offset?: number; duration?: number; immediate?: boolean }
  ) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  getLenis: () => null,
  scrollTo: () => {},
});

export const useSmoothScroll = () => useContext(SmoothScrollContext);

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let teardown: (() => void) | null = null;

    const start = () => {
      // Configuración cinematográfica de Lenis para un scroll fluido de agencia
      const lenis = new Lenis({
        duration: 1.25,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.5,
      });

      lenisRef.current = lenis;

      // Sincronización bidireccional entre Lenis y ScrollTrigger
      const handleScroll = () => {
        ScrollTrigger.update();
      };
      lenis.on("scroll", handleScroll);

      // Refresh inicial seguro tras montar Lenis
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      const updateTicker = (time: number) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(updateTicker);
      gsap.ticker.lagSmoothing(0);

      teardown = () => {
        gsap.ticker.remove(updateTicker);
        lenis.off("scroll", handleScroll);
        lenis.destroy();
        lenisRef.current = null;
      };
    };

    const stop = () => {
      teardown?.();
      teardown = null;
    };

    // Con movimiento reducido se usa el scroll nativo del navegador (sin Lenis)
    const sync = () => {
      stop();
      if (!mql.matches) start();
    };

    sync();
    mql.addEventListener("change", sync);

    return () => {
      mql.removeEventListener("change", sync);
      stop();
    };
  }, []);

  const getLenis = useCallback(() => lenisRef.current, []);

  const scrollTo = useCallback(
    (
      target: string | HTMLElement | number,
      options?: { offset?: number; duration?: number; immediate?: boolean }
    ) => {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, {
          offset: options?.offset ?? 0,
          duration: options?.duration ?? 1.5,
          immediate: options?.immediate ?? false,
        });
      } else if (typeof window !== "undefined") {
        const behavior: ScrollBehavior = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
          ? "auto"
          : "smooth";
        if (typeof target === "string") {
          const el = document.querySelector(target);
          el?.scrollIntoView({ behavior });
        } else if (typeof target === "number") {
          window.scrollTo({ top: target, behavior });
        } else if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior });
        }
      }
    },
    []
  );

  return (
    <SmoothScrollContext.Provider value={{ getLenis, scrollTo }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
