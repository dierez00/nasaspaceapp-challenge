"use client";

import React from "react";

export function CupolaFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* 1. Marco Exterior Octogonal Biselado (Cupola Window Geometry en SVG) */}
      <svg
        className="w-full h-full absolute inset-0"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente Metálico Biselado Estilo ISS / Orion */}
          <linearGradient id="bevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#020617" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Sombra de Borde de Ventana */}
          <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="transparent" />
            <stop offset="98%" stopColor="rgba(15, 23, 42, 0.45)" />
            <stop offset="100%" stopColor="rgba(2, 6, 23, 0.95)" />
          </radialGradient>
        </defs>

        {/* Borde Biselado Perimetral con Chamfers Diagonales en Esquinas */}
        <polygon
          points="
            0,0 1920,0 1920,1080 0,1080 0,0
            40,110 110,40 1810,40 1880,110 1880,970 1810,1040 110,1040 40,970 40,110
          "
          fill="url(#bevelGrad)"
          fillRule="evenodd"
          opacity="0.94"
        />

        {/* Línea de contorno interior de alta precisión (Hairline aeroespacial) */}
        <polygon
          points="
            40,110 110,40 1810,40 1880,110 1880,970 1810,1040 110,1040 40,970
          "
          fill="none"
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth="1.5"
        />

        {/* Remaches de Montura de la Escotilla (Rivets aeroespaciales) */}
        {[
          { x: 110, y: 35 }, { x: 350, y: 35 }, { x: 650, y: 35 }, { x: 960, y: 35 },
          { x: 1270, y: 35 }, { x: 1570, y: 35 }, { x: 1810, y: 35 },
          { x: 1885, y: 110 }, { x: 1885, y: 380 }, { x: 1885, y: 690 }, { x: 1885, y: 970 },
          { x: 1810, y: 1045 }, { x: 1570, y: 1045 }, { x: 1270, y: 1045 }, { x: 960, y: 1045 },
          { x: 650, y: 1045 }, { x: 350, y: 1045 }, { x: 110, y: 1045 },
          { x: 35, y: 970 }, { x: 35, y: 690 }, { x: 35, y: 380 }, { x: 35, y: 110 }
        ].map((rivet, i) => (
          <circle
            key={i}
            cx={rivet.x}
            cy={rivet.y}
            r="3.5"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="0.8"
            opacity="0.85"
          />
        ))}

        {/* Retículas y Marcadores de Calibración Óptica en Esquinas */}
        {/* Esquina Superior Izquierda */}
        <g stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.2">
          <line x1="110" y1="52" x2="135" y2="52" />
          <line x1="110" y1="52" x2="110" y2="77" />
        </g>
        {/* Esquina Superior Derecha */}
        <g stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.2">
          <line x1="1810" y1="52" x2="1785" y2="52" />
          <line x1="1810" y1="52" x2="1810" y2="77" />
        </g>
        {/* Esquina Inferior Izquierda */}
        <g stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.2">
          <line x1="110" y1="1028" x2="135" y2="1028" />
          <line x1="110" y1="1028" x2="110" y2="1003" />
        </g>
        {/* Esquina Inferior Derecha */}
        <g stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.2">
          <line x1="1810" y1="1028" x2="1785" y2="1028" />
          <line x1="1810" y1="1028" x2="1810" y2="1003" />
        </g>
      </svg>

      {/* 2. Reflejo Diagonal Suave de Cristal (Glass Glare) */}
      <div
        className="absolute inset-0 w-full h-full opacity-60"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.015) 25%, transparent 55%, rgba(56,189,248,0.03) 100%)",
        }}
      />

    </div>
  );
}
export default CupolaFrame;
