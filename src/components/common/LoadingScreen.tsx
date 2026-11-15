"use client";

import React, { useState, useEffect } from "react";
import * as THREE from "three";

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    let currentProgress = 0;
    let realThreeProgress = 0;
    const duration = 1400; // ms de tiempo base suave para telemetría
    const startTime = performance.now();

    // Sincronización con el LoadingManager de Three.js (texturas de la Tierra, Luna y estrellas)
    THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
      if (total > 0) {
        realThreeProgress = Math.round((loaded / total) * 100);
      }
    };

    THREE.DefaultLoadingManager.onLoad = () => {
      realThreeProgress = 100;
    };

    let animationFrameId: number;

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const simulated = Math.min((elapsed / duration) * 100, 100);

      // El progreso avanza de forma fluida y se apoya en la carga real de texturas
      currentProgress = Math.max(simulated, realThreeProgress);
      setProgress(currentProgress);

      if (currentProgress < 100) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        // Pausa breve en 100% para mostrar "SYSTEMS NOMINAL" antes de desvanecer
        setTimeout(() => {
          setIsFading(true);
          // Desmontar completamente tras el fundido de 700ms
          setTimeout(() => {
            setIsMounted(false);
          }, 700);
        }, 250);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!isMounted) return null;

  const getTelemetryMessage = (p: number) => {
    if (p < 35) return "[ INITIALIZING NASA PSI TELEMETRY... ]";
    if (p < 75) return "[ LOADING 2K LUNAR & EARTH TEXTURES... ]";
    if (p < 100) return "[ CALIBRATING MICROGRAVITY DIFFUSION SIMULATOR... ]";
    return "[ SYSTEMS NOMINAL · ENTERING ATLAS ]";
  };

  return (
    <div
      aria-label="Cargando Atlas del Fuego Lunar"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`fixed inset-0 z-50 bg-white flex flex-col items-center justify-center select-none transition-opacity duration-700 ease-out ${
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

          <h1 className="text-2xl sm:text-4xl font-black tracking-widest uppercase text-slate-900 drop-shadow-sm">
            ATLAS DEL FUEGO LUNAR
          </h1>

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
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="url(#loadingCyanGrad)"
              strokeWidth="4"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 - (251.2 * progress) / 100}
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
          <span className="font-mono text-xs font-bold text-slate-800 tracking-tighter">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Barra de Progreso Estilizada */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/90 mb-4 p-[1px]">
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 rounded-full transition-all duration-150 ease-out shadow-[0_0_10px_#38bdf8]"
          />
        </div>

        {/* Telemetría Dinámica de Misión */}
        <p className="font-mono text-[11px] sm:text-xs tracking-wider text-slate-700 h-5 font-medium">
          {getTelemetryMessage(progress)}
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

