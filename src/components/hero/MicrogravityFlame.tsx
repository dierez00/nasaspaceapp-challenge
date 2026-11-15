"use client";

import React from "react";

export function MicrogravityFlame() {
  return (
    <div className="relative flex items-center justify-center select-none pointer-events-none">
      {/* 1. Halo Exterior Amplio (Difusión de Oxígeno en Microgravedad) */}
      <div
        className="absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full blur-2xl opacity-40 mix-blend-screen pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(59, 130, 246, 0.12) 45%, rgba(99, 102, 241, 0.05) 65%, transparent 75%)",
        }}
      />

      {/* Capa de difusión exterior de tamaño generoso (w-36 h-36) */}
      <div
        className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full blur-xl mix-blend-screen pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(6, 182, 212, 0.28) 0%, rgba(37, 99, 235, 0.14) 45%, transparent 75%)",
        }}
      />

      {/* 2. Cuerpo Central (Plasma de Combustión Volumétrico) */}
      <div
        className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 opacity-80 blur-md mix-blend-screen animate-pulse flex items-center justify-center"
        style={{
          animationDuration: "3.5s",
          boxShadow: "0 0 20px rgba(56, 189, 248, 0.6)",
        }}
      />

      {/* Delicado anillo de reacción estequiométrica (NASA FLEX / SAFFIRE) */}
      <div
        className="absolute z-15 w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-cyan-300/40 mix-blend-screen opacity-70 pointer-events-none"
        style={{
          boxShadow: "inset 0 0 12px rgba(56, 189, 248, 0.5), 0 0 15px rgba(6, 182, 212, 0.4)",
        }}
      />

      {/* 3. Núcleo Incandescente Ultrabrillante (Zona de Reacción Primaria) */}
      <div
        className="absolute z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-[0_0_25px_10px_rgba(56,189,248,0.9)] mix-blend-screen"
      />
    </div>
  );
}

// Exportación dual para compatibilidad total
export const VolumetricFlameParticles = MicrogravityFlame;
export default MicrogravityFlame;
