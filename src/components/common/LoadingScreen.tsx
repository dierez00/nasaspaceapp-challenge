"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  HERO_LOAD_PROGRESS_EVENT,
  type HeroLoadProgressDetail,
} from "./hero-load-events";

const RING_LENGTH = 251.2;
const FADE_MS = 700;
// Upper bound for the whole sequence: hide the screen even if WebGL or textures never finish.
const SAFETY_TIMEOUT_MS = 8000;

const getTelemetryMessage = (p: number) => {
  if (p < 35) return "[ INITIALIZING NASA PSI TELEMETRY... ]";
  if (p < 75) return "[ LOADING 2K LUNAR & EARTH TEXTURES... ]";
  if (p < 100) return "[ CALIBRATING MICROGRAVITY DIFFUSION SIMULATOR... ]";
  return "[ SYSTEMS NOMINAL · ENTERING ATLAS ]";
};

export function LoadingScreen() {
  const [isFading, setIsFading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Progress is written straight to the DOM; per-frame React state would re-render the tree.
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const duration = 1400; // ms de tiempo base suave para telemetría
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
        String(RING_LENGTH - (RING_LENGTH * p) / 100)
      );
      if (barRef.current) barRef.current.style.width = `${p}%`;
      if (percentRef.current) percentRef.current.textContent = `${rounded}%`;
      if (messageRef.current) messageRef.current.textContent = getTelemetryMessage(p);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(animationFrameId);
      paint(100);
      // Pausa breve en 100% para mostrar "SYSTEMS NOMINAL" antes de desvanecer
      timers.push(
        window.setTimeout(() => {
          setIsFading(true);
          // Desmontar completamente tras el fundido de 700ms
          timers.push(window.setTimeout(() => setIsMounted(false), FADE_MS));
        }, 250)
      );
    };

    // Sincronización con la carga real de texturas (Tierra, Luna y estrellas) del fondo 3D
    const onHeroProgress = (event: Event) => {
      const { percent } = (event as CustomEvent<HeroLoadProgressDetail>).detail;
      realProgress = percent;
    };
    window.addEventListener(HERO_LOAD_PROGRESS_EVENT, onHeroProgress);

    const tick = (currentTime: number) => {
      const simulated = Math.min(((currentTime - startTime) / duration) * 100, 100);
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
      aria-label="Cargando Atlas del Fuego Lunar"
      role="progressbar"
      aria-busy={!isFading}
      aria-hidden={isFading || undefined}
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`loading-screen-failsafe fixed inset-0 z-50 bg-white flex flex-col items-center justify-center select-none transition-opacity duration-700 ease-out ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      }`}
    >
      {/* Fondo técnico sutil con micro-malla aeroespacial */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none" />

      {/* Contenedor Central HUD */}
      <div className="relative z-10 flex flex-col items-center max-w-xl w-full px-8 text-center">
        {/* Identificador de Misión Principal */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full border border-cyan-500/60 flex items-center justify-center text-cyan-600 font-mono text-xs font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]">
              ✦
            </span>
            <span className="font-mono text-xs tracking-widest text-cyan-600 uppercase font-semibold">
              NASA PSI RESEARCH · LAB 01
            </span>
          </div>

          <p className="text-2xl sm:text-4xl font-black tracking-widest uppercase text-slate-900 drop-shadow-sm">
            ATLAS DEL FUEGO LUNAR
          </p>

          <span className="font-mono text-[11px] sm:text-xs tracking-widest text-slate-400 uppercase mt-1">
            LUNAR COMBUSTION RESEARCH SYSTEM
          </span>
        </div>

        {/* Indicador de Carga Circular / Giroscopio HUD */}
        <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
          {/* Anillo exterior giratorio */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/40 animate-spin [animation-duration:8s] motion-reduce:animate-none" />
          {/* Anillo de precisión con degradado */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="4"
            />
            <circle
              ref={ringRef}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="url(#loadingCyanGrad)"
              strokeWidth="4"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-150 ease-out"
            />
            <defs>
              <linearGradient id="loadingCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
          </svg>
          {/* Porcentaje numérico central */}
          <span
            ref={percentRef}
            className="font-mono text-xs font-bold text-slate-800 tracking-tighter"
          >
            0%
          </span>
        </div>

        {/* Barra de Progreso Estilizada */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/90 mb-4 p-[1px]">
          <div
            ref={barRef}
            style={{ width: "0%" }}
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 rounded-full transition-all duration-150 ease-out shadow-[0_0_10px_#38bdf8]"
          />
        </div>

        {/* Telemetría Dinámica de Misión */}
        <p
          ref={messageRef}
          className="font-mono text-[11px] sm:text-xs tracking-wider text-slate-700 h-5 font-medium"
        >
          {getTelemetryMessage(0)}
        </p>

        {/* Metadatos Técnicos Inferiores */}
        <div className="mt-8 pt-4 border-t border-slate-200/60 w-full flex items-center justify-between font-mono text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
            TELEMETRY LINK OK
          </span>
          <span>EST. COMBUSTION µg/1g</span>
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;

