"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useSmoothScroll } from "@/components/common/SmoothScrollProvider";

interface LayerStyle {
  transform: string;
  opacity: number;
  filter?: string;
}

interface Frame {
  rootOpacity: number;
  interactive: boolean;
  beam: LayerStyle;
  aura: LayerStyle;
  wall: LayerStyle;
  plasma: LayerStyle;
  text: LayerStyle;
}

// Estado visual del indicador para un desplazamiento efectivo (rango total de 0 a 220px)
function computeFrame(effectiveScroll: number): Frame {
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

  return {
    rootOpacity: progressLaunch >= 1 ? 0 : 1,
    interactive: effectiveScroll <= 15,
    beam: {
      transform:
        progressLaunch > 0
          ? `translateY(${-progressLaunch * 120}px) scaleY(${1 + progressLaunch * 1.8})`
          : `translateY(0) scaleY(${beamPrimeScale})`,
      opacity: beamOpacity,
      filter: `blur(${1 + progressLaunch * 3}px)`,
    },
    aura: {
      transform:
        progressLaunch > 0
          ? `translateY(${-progressLaunch * 100}px) scale(${1 + progressLaunch * 1.5})`
          : `translateY(0) scale(${0.5 + beamPrimeScale * 0.5})`,
      opacity: auraOpacity,
    },
    wall: {
      transform:
        progressLaunch > 0
          ? `scaleX(${Math.max(0, 1 - progressLaunch * 0.8)}) translateY(${-progressLaunch * 20}px)`
          : `scaleX(${progressCrush}) translateY(0)`,
      opacity:
        progressLaunch > 0
          ? Math.max(0, 1 - progressLaunch * 1.5)
          : progressCrush,
    },
    plasma: {
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
    },
    text: {
      transform:
        progressLaunch > 0
          ? `scaleX(0) scaleY(1.3) translateY(-10px)`
          : `scaleX(${Math.max(0, 1 - progressCrush)}) scaleY(${1 + 0.25 * progressCrush})`,
      opacity:
        progressLaunch > 0 ? 0 : Math.max(0, 1 - progressCrush * 1.15),
      filter: `blur(${progressCrush * 4}px)`,
    },
  };
}

function applyLayer(el: HTMLElement | null, layer: LayerStyle) {
  if (!el) return;
  el.style.transform = layer.transform;
  el.style.opacity = String(layer.opacity);
  if (layer.filter !== undefined) el.style.filter = layer.filter;
}

function toStyle(layer: LayerStyle): React.CSSProperties {
  return {
    transform: layer.transform,
    opacity: layer.opacity,
    ...(layer.filter !== undefined ? { filter: layer.filter } : {}),
  };
}

const INITIAL_FRAME = computeFrame(0);

export function ScrollIndicator() {
  const { scrollTo } = useSmoothScroll();
  const rootRef = useRef<HTMLButtonElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const wallLeftRef = useRef<HTMLDivElement>(null);
  const wallRightRef = useRef<HTMLDivElement>(null);
  const plasmaRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Mutable animation state: updated per scroll/frame without re-rendering React
  const state = useRef({
    scrollY: 0,
    isManual: false,
    manualProgress: 0,
    rafId: 0,
    timeoutId: 0,
  });

  const render = useCallback(() => {
    const { scrollY, isManual, manualProgress } = state.current;
    const frame = computeFrame(isManual ? manualProgress * 220 : scrollY);
    const root = rootRef.current;
    if (root) {
      root.style.opacity = String(frame.rootOpacity);
      root.dataset.interactive = String(frame.interactive);
      root.tabIndex = frame.interactive ? 0 : -1;
    }
    applyLayer(beamRef.current, frame.beam);
    applyLayer(auraRef.current, frame.aura);
    applyLayer(wallLeftRef.current, frame.wall);
    applyLayer(wallRightRef.current, frame.wall);
    applyLayer(plasmaRef.current, frame.plasma);
    applyLayer(textRef.current, frame.text);
  }, []);

  // Detección continua y proporcional del scroll en tiempo real
  useEffect(() => {
    const current = state.current;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          current.scrollY = window.scrollY;

          // Si el usuario regresa al tope de la pantalla, reiniciar cualquier trigger manual
          if (current.scrollY <= 15) {
            current.isManual = false;
            current.manualProgress = 0;
          }

          render();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Verificación inicial de montaje
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(current.rafId);
      window.clearTimeout(current.timeoutId);
    };
  }, [render]);

  const handleScrollToDashboard = () => {
    const current = state.current;

    // Con movimiento reducido: ir directo al Atlas, sin la animación de compresión y disparo
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      scrollTo("#dashboard", { immediate: true });
      return;
    }

    current.isManual = true;
    const startTime = performance.now();
    const duration = 800; // ms de progresión cinemática en clic

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const p = Math.min(elapsed / duration, 1);
      current.manualProgress = p;
      render();

      if (p < 1) {
        current.rafId = window.requestAnimationFrame(animate);
      }
    };

    window.cancelAnimationFrame(current.rafId);
    current.rafId = window.requestAnimationFrame(animate);

    window.clearTimeout(current.timeoutId);
    current.timeoutId = window.setTimeout(() => {
      scrollTo("#dashboard", { duration: 1.8 });
    }, 250);
  };

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={handleScrollToDashboard}
      aria-label="Deslizar para explorar el Atlas"
      data-interactive="true"
      style={{ opacity: INITIAL_FRAME.rootOpacity }}
      className="relative flex items-center justify-center select-none group px-6 py-2 transition-opacity duration-300 ease-out cursor-pointer pointer-events-auto data-[interactive=false]:cursor-auto data-[interactive=false]:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 rounded-full"
    >
      {/* 1. Rayo / Destello Láser Vertical Ascendente (Cian / Pizarra Tecnológico) */}
      <div
        ref={beamRef}
        style={toStyle(INITIAL_FRAME.beam)}
        className="absolute -top-6 w-1.5 h-28 rounded-full bg-gradient-to-t from-transparent via-cyan-500 to-slate-900 pointer-events-none shadow-[0_0_16px_#0284c7] transition-[transform,opacity,filter] duration-200 ease-out"
      />
      <div
        ref={auraRef}
        style={toStyle(INITIAL_FRAME.aura)}
        className="absolute -top-10 w-24 h-32 rounded-full bg-cyan-500/25 pointer-events-none blur-xl transition-[transform,opacity] duration-200 ease-out"
      />

      {/* 2. Pared Lateral Izquierda de Energía (Colisiona hacia el centro sobre fondo blanco) */}
      <div
        ref={wallLeftRef}
        style={toStyle(INITIAL_FRAME.wall)}
        className="absolute right-1/2 top-1/2 -translate-y-1/2 h-[2px] w-40 bg-gradient-to-r from-transparent via-cyan-500 to-slate-800 shadow-[0_0_10px_#0284c7] pointer-events-none origin-right transition-[transform,opacity] duration-200 ease-out"
      />

      {/* 3. Pared Lateral Derecha de Energía (Colisiona hacia el centro sobre fondo blanco) */}
      <div
        ref={wallRightRef}
        style={toStyle(INITIAL_FRAME.wall)}
        className="absolute left-1/2 top-1/2 -translate-y-1/2 h-[2px] w-40 bg-gradient-to-l from-transparent via-cyan-500 to-slate-800 shadow-[0_0_10px_#0284c7] pointer-events-none origin-left transition-[transform,opacity] duration-200 ease-out"
      />

      {/* 4. Línea de Plasma Central Aplastada (Núcleo de impacto cian/pizarra) */}
      <div
        ref={plasmaRef}
        style={toStyle(INITIAL_FRAME.plasma)}
        className="absolute top-1/2 -translate-y-1/2 h-[2px] w-20 rounded-full bg-gradient-to-r from-cyan-500 via-slate-900 to-cyan-500 shadow-[0_0_12px_#0284c7] pointer-events-none origin-center transition-[transform,opacity] duration-200 ease-out"
      />

      {/* 5. Texto Plano en Cápsula HUD Aeroespacial Clara */}
      <div
        ref={textRef}
        style={toStyle(INITIAL_FRAME.text)}
        className="relative z-10 flex items-center gap-2 font-mono text-xs sm:text-sm tracking-wider text-slate-800 group-hover:text-cyan-600 bg-white/90 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.06)] origin-center transition-[transform,opacity,filter,color] duration-200 ease-out group-data-[interactive=true]:animate-bounce motion-reduce:animate-none"
      >
        <span className="font-medium">Desliza para explorar el Atlas</span>
        <span className="text-cyan-600 text-sm font-sans drop-shadow-[0_0_6px_#38bdf8] inline-block transition-transform group-hover:translate-y-0.5">
          ↓
        </span>
      </div>
    </button>
  );
}

export default ScrollIndicator;
