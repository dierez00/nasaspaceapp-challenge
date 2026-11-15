"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MicrogravityFlame } from "./MicrogravityFlame";
import { CupolaFrame } from "./CupolaFrame";
import { ScrollIndicator } from "./ScrollIndicator";

// Carga dinámica de SpaceBackdrop3D con ssr: false para garantizar renderizado WebGL limpio en cliente
const SpaceBackdrop3D = dynamic(
  () => import("./SpaceBackdrop3D").then((mod) => mod.SpaceBackdrop3D),
  { ssr: false }
);

export function HeroSection() {
  return (
    <section className="h-screen w-full relative overflow-hidden bg-white flex flex-col justify-between items-center py-10 select-none">
      {/* 1. Capa 3D de Fondo (z-0): Skybox de estrellas, Tierra lejana y Luna (Canvas con fondo negro espacial profundo) */}
      <SpaceBackdrop3D />

      {/* 2. Capa de Superposición de Escotilla (z-20): Marco de cúpula blanco aeroespacial, biseles y HUD */}
      <CupolaFrame />

      {/* 2.1 Logotipo ATLAS (Arriba a la Izquierda, z-30) */}
      <div className="absolute top-4 sm:top-6 left-6 sm:left-10 z-30 pointer-events-auto">
        <div className="flex items-center gap-2.5 select-none">
          <div className="relative grid place-items-center w-8 h-8 sm:w-9 sm:h-9 border border-[#0b3d91] rounded-full shrink-0">
            <span className="font-serif italic text-xl sm:text-2xl text-[#0b3d91] leading-none select-none">
              a
            </span>
            <span className="absolute -top-1 -right-0.5 text-[9px] font-sans font-bold text-[#0b3d91] bg-white px-0.5 select-none">
              ✦
            </span>
            <span className="absolute w-11 h-2.5 border border-[#0b3d91] rounded-full -rotate-[40deg] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 2.2 Logotipo NASA (Arriba a la Derecha, z-30) */}
      <div className="absolute top-4 sm:top-6 right-6 sm:right-10 z-30 pointer-events-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/NASA_logo.webp"
          alt="NASA"
          className="h-8 sm:h-9 w-auto object-contain select-none"
        />
      </div>

      {/* 3. Título Principal Único (z-30): Tipografía volumétrica aeroespacial en dos líneas */}
      <div className="relative z-30 pt-4 sm:pt-6 px-6 text-center max-w-4xl mx-auto flex flex-col items-center pointer-events-none">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.25em] uppercase drop-shadow-[0_0_25px_rgba(56,189,248,0.35)] flex flex-col items-center leading-tight">
          <span className="bg-gradient-to-b from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
            ATLAS DEL FUEGO
          </span>
          <span className="bg-gradient-to-b from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent tracking-[0.3em]">
            LUNAR
          </span>
        </h1>
      </div>

      {/* 4. Capa Central: Llama Esférica de Difusión en Microgravedad (NASA FLEX / SAFFIRE) */}
      <div className="relative z-10 flex items-center justify-center pointer-events-none">
        <MicrogravityFlame />
      </div>

      {/* 5. Indicador Futurista de Teletransportación hacia el Dashboard (z-30) */}
      <div className="relative z-30 pb-2 sm:pb-3 flex flex-col items-center pointer-events-auto">
        <ScrollIndicator />
      </div>
    </section>
  );
}

export default HeroSection;
