"use client";

import { AtlasMark } from "@/components/brand/atlas-mark";
import React, { useEffect, useRef, useState } from "react";
import {
  HERO_LOAD_PROGRESS_EVENT,
  type HeroLoadProgressDetail,
} from "./hero-load-events";
import { getLocale, useLocale, useT, type Locale } from "@/shared/i18n/locale";

const RING_LENGTH = 251.2;
const FADE_MS = 700;
// Upper bound for the whole sequence: hide the screen even if WebGL or textures never finish.
const SAFETY_TIMEOUT_MS = 8000;

const getMessage = (p: number, locale: Locale) => {
  const en = locale === "en";
  if (p < 35) return en ? "Preparing the cabin…" : "Preparando la cabina…";
  if (p < 75)
    return en ? "Loading the Moon and Earth…" : "Cargando la Luna y la Tierra…";
  if (p < 100) return en ? "Lighting the flame…" : "Encendiendo la llama…";
  return en ? "All set" : "Todo listo";
};

export function LoadingScreen() {
  const t = useT();
  const locale = useLocale();
  const [isFading, setIsFading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Progress is written straight to the DOM; per-frame React state would re-render the tree.
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const duration = 1400; // ms de tiempo base suave
    const startTime = performance.now();
    let realProgress = 0;
    let finished = false;
    let animationFrameId = 0;
    const timers: number[] = [];

    const paint = (p: number) => {
      const rounded = Math.round(p);
      rootRef.current?.setAttribute("aria-valuenow", String(rounded));
      ringRef.current?.setAttribute(
        "stroke-dashoffset",
        String(RING_LENGTH - (RING_LENGTH * p) / 100),
      );
      if (percentRef.current) percentRef.current.textContent = `${rounded}%`;
      if (messageRef.current)
        messageRef.current.textContent = getMessage(p, getLocale());
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(animationFrameId);
      paint(100);
      // Pausa breve en 100% para mostrar "Todo listo" antes de desvanecer
      timers.push(
        window.setTimeout(() => {
          setIsFading(true);
          // Desmontar completamente tras el fundido de 700ms
          timers.push(window.setTimeout(() => setIsMounted(false), FADE_MS));
        }, 250),
      );
    };

    // Sincronización con la carga real de texturas (Tierra, Luna y estrellas) del fondo 3D
    const onHeroProgress = (event: Event) => {
      const { percent } = (event as CustomEvent<HeroLoadProgressDetail>).detail;
      realProgress = percent;
    };
    window.addEventListener(HERO_LOAD_PROGRESS_EVENT, onHeroProgress);

    const tick = (currentTime: number) => {
      const simulated = Math.min(
        ((currentTime - startTime) / duration) * 100,
        100,
      );
      // El progreso avanza de forma fluida y se apoya en la carga real de texturas
      const current = Math.max(simulated, realProgress);
      if (current >= 100) {
        finish();
        return;
      }
      paint(current);
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    timers.push(window.setTimeout(finish, SAFETY_TIMEOUT_MS));

    return () => {
      window.removeEventListener(HERO_LOAD_PROGRESS_EVENT, onHeroProgress);
      cancelAnimationFrame(animationFrameId);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div
      ref={rootRef}
      aria-label={t(
        "Loading the Lunar Fire Atlas",
        "Cargando Atlas del Fuego Lunar",
      )}
      role="progressbar"
      aria-busy={!isFading}
      aria-hidden={isFading || undefined}
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`loading-screen-failsafe theme-cabin fixed inset-0 z-50 flex flex-col items-center justify-center select-none transition-opacity duration-700 ease-out ${
        isFading
          ? "opacity-0 pointer-events-none"
          : "opacity-100 pointer-events-auto"
      }`}
    >
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-8 text-center">
        <AtlasMark className="mb-5 h-12 w-12" />

        <p className="font-display text-2xl font-semibold tracking-tight text-[#f4f7fb] sm:text-3xl">
          {t("Lunar Fire Atlas", "Atlas del fuego lunar")}
        </p>

        {/* Anillo de progreso */}
        <div className="relative mt-9 mb-6 flex h-24 w-24 items-center justify-center">
          <svg
            className="h-full w-full -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(233, 237, 243, 0.14)"
              strokeWidth="5"
            />
            <circle
              ref={ringRef}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#ff5a1f"
              strokeWidth="5"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-150 ease-out"
            />
          </svg>
          <span
            ref={percentRef}
            className="absolute font-mono text-base font-medium tabular-nums text-[#e9edf3]"
          >
            0%
          </span>
        </div>

        <p ref={messageRef} className="h-6 text-base text-[#cfd8e6]">
          {getMessage(0, locale)}
        </p>
      </div>
    </div>
  );
}

export default LoadingScreen;
