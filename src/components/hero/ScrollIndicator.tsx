"use client";

import React, { useState, useEffect } from "react";
import { useSmoothScroll } from "@/components/common/SmoothScrollProvider";
import { useT } from "@/shared/i18n/locale";

export function ScrollIndicator() {
  const t = useT();
  const { scrollTo } = useSmoothScroll();
  const [scrollY, setScrollY] = useState(0);
  const [isManual, setIsManual] = useState(false);
  const [manualProgress, setManualProgress] = useState(0);

  // Detección continua y proporcional del scroll en tiempo real
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          setScrollY(y);

          // Si el usuario regresa al tope de la pantalla, reiniciar cualquier trigger manual
          if (y <= 15) {
            setIsManual(false);
            setManualProgress(0);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Verificación inicial de montaje
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToDashboard = () => {
    setIsManual(true);
    const startTime = performance.now();
    const duration = 800; // ms de progresión cinemática en clic

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const p = Math.min(elapsed / duration, 1);
      setManualProgress(p);

      if (p < 1) {
        window.requestAnimationFrame(animate);
      }
    };

    window.requestAnimationFrame(animate);

    setTimeout(() => {
      scrollTo("#dashboard", { duration: 1.8 });
    }, 250);
  };

  // Desplazamiento efectivo interpolado (rango total extendido de 0 a 220px)
  const effectiveScroll = isManual ? manualProgress * 220 : scrollY;

  // Fase 1: Compresión de paredes y aplastamiento de texto (15px a 130px -> 115px de recorrido)
  const progressCrush = Math.min(Math.max((effectiveScroll - 15) / 115, 0), 1);

  // Fase 2: Disparo de destello vertical ascendente y desvanecimiento (130px a 220px -> 90px de recorrido)
  const progressLaunch = Math.min(Math.max((effectiveScroll - 130) / 90, 0), 1);

  // Activación sutil del rayo preparatorio al final de la compresión
  const beamPrimeScale = progressCrush > 0.6 ? (progressCrush - 0.6) / 0.4 : 0;
  const beamOpacity =
    progressLaunch > 0
      ? progressLaunch < 0.2
        ? 1
        : Math.max(0, 1 - (progressLaunch - 0.2) / 0.8)
      : beamPrimeScale * 0.8;

  const auraOpacity =
    progressLaunch > 0
      ? Math.max(0, (1 - progressLaunch) * 0.8)
      : beamPrimeScale * 0.6;

  const isInteractive = effectiveScroll <= 15;

  return (
    <div
      onClick={handleScrollToDashboard}
      role="button"
      tabIndex={0}
      aria-label={t("Scroll to explore the Atlas", "Deslizar para explorar el Atlas")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleScrollToDashboard();
        }
      }}
      style={{
        opacity: progressLaunch >= 1 ? 0 : 1,
      }}
      className={`relative flex items-center justify-center select-none group px-6 py-2 transition-opacity duration-300 ease-out ${
        isInteractive ? "cursor-pointer pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* 1. Rayo / Destello Láser Vertical Ascendente (Cian / Pizarra Tecnológico) */}
      <div
        style={{
          transform:
            progressLaunch > 0
              ? `translateY(${-progressLaunch * 120}px) scaleY(${1 + progressLaunch * 1.8})`
              : `translateY(0) scaleY(${beamPrimeScale})`,
          opacity: beamOpacity,
          filter: `blur(${1 + progressLaunch * 3}px)`,
        }}
        className="absolute -top-6 w-1.5 h-28 rounded-full bg-gradient-to-t from-transparent via-cyan-500 to-slate-900 pointer-events-none shadow-[0_0_16px_#0284c7] transition-all duration-200 ease-out"
      />
      <div
        style={{
          transform:
            progressLaunch > 0
              ? `translateY(${-progressLaunch * 100}px) scale(${1 + progressLaunch * 1.5})`
              : `translateY(0) scale(${0.5 + beamPrimeScale * 0.5})`,
          opacity: auraOpacity,
        }}
        className="absolute -top-10 w-24 h-32 rounded-full bg-cyan-500/25 pointer-events-none blur-xl transition-all duration-200 ease-out"
      />

      {/* 2. Pared Lateral Izquierda de Energía (Colisiona hacia el centro sobre fondo blanco) */}
      <div
        style={{
          transform:
            progressLaunch > 0
              ? `scaleX(${Math.max(0, 1 - progressLaunch * 0.8)}) translateY(${-progressLaunch * 20}px)`
              : `scaleX(${progressCrush}) translateY(0)`,
          opacity:
            progressLaunch > 0
              ? Math.max(0, 1 - progressLaunch * 1.5)
              : progressCrush,
        }}
        className="absolute right-1/2 top-1/2 -translate-y-1/2 h-[2px] w-40 bg-gradient-to-r from-transparent via-cyan-500 to-slate-800 shadow-[0_0_10px_#0284c7] pointer-events-none origin-right transition-all duration-200 ease-out"
      />

      {/* 3. Pared Lateral Derecha de Energía (Colisiona hacia el centro sobre fondo blanco) */}
      <div
        style={{
          transform:
            progressLaunch > 0
              ? `scaleX(${Math.max(0, 1 - progressLaunch * 0.8)}) translateY(${-progressLaunch * 20}px)`
              : `scaleX(${progressCrush}) translateY(0)`,
          opacity:
            progressLaunch > 0
              ? Math.max(0, 1 - progressLaunch * 1.5)
              : progressCrush,
        }}
        className="absolute left-1/2 top-1/2 -translate-y-1/2 h-[2px] w-40 bg-gradient-to-l from-transparent via-cyan-500 to-slate-800 shadow-[0_0_10px_#0284c7] pointer-events-none origin-left transition-all duration-200 ease-out"
      />

      {/* 4. Línea de Plasma Central Aplastada (Núcleo de impacto cian/pizarra) */}
      <div
        style={{
          transform:
            progressLaunch > 0
              ? `scaleX(${Math.max(0, 1 - progressLaunch)}) scaleY(${1 + progressLaunch * 2}) translateY(${-progressLaunch * 40}px)`
              : `scaleX(${progressCrush}) scaleY(1) translateY(0)`,
          opacity:
            progressLaunch > 0
              ? Math.max(0, 1 - progressLaunch * 1.5)
              : progressCrush > 0.2
              ? (progressCrush - 0.2) / 0.8
              : 0,
        }}
        className="absolute top-1/2 -translate-y-1/2 h-[2px] w-20 rounded-full bg-gradient-to-r from-cyan-500 via-slate-900 to-cyan-500 shadow-[0_0_12px_#0284c7] pointer-events-none origin-center transition-all duration-200 ease-out"
      />

      {/* 5. Texto Plano en Cápsula HUD Aeroespacial Clara */}
      <div
        style={{
          transform:
            progressLaunch > 0
              ? `scaleX(0) scaleY(1.3) translateY(-10px)`
              : `scaleX(${Math.max(0, 1 - progressCrush)}) scaleY(${1 + 0.25 * progressCrush})`,
          opacity:
            progressLaunch > 0
              ? 0
              : Math.max(0, 1 - progressCrush * 1.15),
          filter: `blur(${progressCrush * 4}px)`,
        }}
        className={`relative z-10 flex items-center gap-2 font-mono text-xs sm:text-sm tracking-wider text-slate-800 group-hover:text-cyan-600 bg-white/90 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.06)] origin-center transition-all duration-200 ease-out ${
          effectiveScroll <= 15 ? "animate-bounce" : ""
        }`}
      >
        <span className="font-medium">{t("Scroll to explore the Atlas", "Desliza para explorar el Atlas")}</span>
        <span className="text-cyan-600 text-sm font-sans drop-shadow-[0_0_6px_#38bdf8] inline-block transition-transform group-hover:translate-y-0.5">
          ↓
        </span>
      </div>
    </div>
  );
}

export default ScrollIndicator;
