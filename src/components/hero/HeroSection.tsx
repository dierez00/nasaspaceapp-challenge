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

      {/* 3. Título Principal Único (z-30): Limpio y contrastado sobre el visor espacial */}
      <div className="relative z-30 pt-4 sm:pt-6 px-6 text-center max-w-4xl mx-auto flex flex-col items-center pointer-events-none">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-cyan-100 uppercase drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
          ATLAS DEL FUEGO LUNAR
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
