"use client";

import React, { useEffect, useRef } from "react";

export function MicrogravityFlame() {
  const flameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const t = (currentTime - startTime) * 0.001; // segundos

      // Deriva sutil y orgánica de microgravedad mediante armónicos desfasados (acotada estrictamente a ±7px)
      const x = Math.sin(t * 0.65) * 4.5 + Math.cos(t * 1.25) * 2.5;
      const y = Math.cos(t * 0.75) * 5.0 + Math.sin(t * 1.15) * 2.5;
      const rot = Math.sin(t * 0.45) * 1.2;

      if (flameRef.current) {
        flameRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={flameRef}
      className="relative flex items-center justify-center select-none pointer-events-none w-56 h-60 sm:w-64 sm:h-68 will-change-transform"
      style={{ mixBlendMode: "screen" }}
    >
      {/* 1. Halo Exterior Amplio de Difusión de Oxígeno (Fondo Ambiental de Combustión Constante) */}
      <div
        className="absolute w-64 h-72 sm:w-80 sm:h-88 rounded-[50%] blur-3xl opacity-45 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(30, 58, 138, 0.08) 60%, transparent 80%)",
        }}
      />

      {/* 2. Domo Principal / Campana de Gas Translúcida en Microgravedad (Brillo Uniforme y Constante) */}
      <div
        className="relative w-48 h-52 sm:w-56 sm:h-60 rounded-[50%_50%_46%_46%] blur-lg opacity-95 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.18) 20%, rgba(56, 189, 248, 0.7) 60%, rgba(30, 58, 138, 0.95) 85%, transparent 100%)",
        }}
      />

      {/* 3. Frente de Reacción Estequiométrica (Borde de Plasma Fijo sin Núcleo Blanco) */}
      <div
        className="absolute w-44 h-48 sm:w-52 sm:h-56 rounded-[50%_50%_46%_46%] border border-cyan-400/35 blur-[1px] opacity-75 pointer-events-none"
        style={{
          boxShadow:
            "0 0 28px rgba(56, 189, 248, 0.4), inset 0 0 20px rgba(14, 165, 233, 0.3)",
        }}
      />

      {/* 4. Núcleo Hueco de Difusión (Centro Translúcido y Frío del Combustible) */}
      <div
        className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full blur-md opacity-45 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

// Exportación dual para compatibilidad total
export const VolumetricFlameParticles = MicrogravityFlame;
export default MicrogravityFlame;
