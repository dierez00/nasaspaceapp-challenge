"use client";

import React from "react";

export function CupolaFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* 1. Marco Exterior Octogonal Biselado (Cupola Window en Blanco Aeroespacial) */}
      <svg
        className="w-full h-full absolute inset-0"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente Blanco / Gris Titanio Limpio Estilo Cleanroom / Orion */}
          <linearGradient id="whiteCupolaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f8fafc" />
            <stop offset="65%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* Sombra de Profundidad en el Bisel Interior hacia el Espacio */}
          <linearGradient id="bevelShadowTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(15, 23, 42, 0.12)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Borde Biselado Perimetral Blanco con Chamfers Diagonales en Esquinas */}
        <polygon
          points="
            0,0 1920,0 1920,1080 0,1080 0,0
            50,130 130,50 1790,50 1870,130 1870,950 1790,1030 130,1030 50,950 50,130
          "
          fill="url(#whiteCupolaGrad)"
          fillRule="evenodd"
          opacity="1"
        />

        {/* Línea de Contorno Exterior de Precisión (Borde de panel estructural) */}
        <polygon
          points="
            50,130 130,50 1790,50 1870,130 1870,950 1790,1030 130,1030 50,950
          "
          fill="none"
          stroke="rgba(15, 23, 42, 0.16)"
          strokeWidth="2.5"
        />

        {/* Línea de Sello Interior de Silicona Aeroespacial (Acento Cian Nítido) */}
        <polygon
          points="
            56,134 134,56 1786,56 1864,134 1864,946 1786,1024 134,1024 56,946
          "
          fill="none"
          stroke="rgba(2, 132, 199, 0.35)"
          strokeWidth="1.2"
        />

        {/* Remaches / Pernos de Montura de Titanio (Mecanizado fino sobre panel blanco) */}
        {[
          { x: 130, y: 32 }, { x: 380, y: 32 }, { x: 680, y: 32 }, { x: 960, y: 32 },
          { x: 1240, y: 32 }, { x: 1540, y: 32 }, { x: 1790, y: 32 },
          { x: 1888, y: 130 }, { x: 1888, y: 400 }, { x: 1888, y: 680 }, { x: 1888, y: 950 },
          { x: 1790, y: 1048 }, { x: 1540, y: 1048 }, { x: 1240, y: 1048 }, { x: 960, y: 1048 },
          { x: 680, y: 1048 }, { x: 380, y: 1048 }, { x: 130, y: 1048 },
          { x: 32, y: 950 }, { x: 32, y: 680 }, { x: 32, y: 400 }, { x: 32, y: 130 }
        ].map((rivet, i) => (
          <g key={i}>
            <circle
              cx={rivet.x}
              cy={rivet.y}
              r="4"
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="1"
            />
            <circle
              cx={rivet.x}
              cy={rivet.y}
              r="1.6"
              fill="#64748b"
            />
          </g>
        ))}

        {/* Retículas y Marcadores de Calibración Óptica en Esquinas (Acentos Cian Nítidos) */}
        {/* Esquina Superior Izquierda */}
        <g stroke="#0284c7" strokeWidth="1.5">
          <line x1="130" y1="68" x2="160" y2="68" />
          <line x1="130" y1="68" x2="130" y2="98" />
          <circle cx="130" cy="68" r="2" fill="#0284c7" />
        </g>
        {/* Esquina Superior Derecha */}
        <g stroke="#0284c7" strokeWidth="1.5">
          <line x1="1790" y1="68" x2="1760" y2="68" />
          <line x1="1790" y1="68" x2="1790" y2="98" />
          <circle cx="1790" cy="68" r="2" fill="#0284c7" />
        </g>
        {/* Esquina Inferior Izquierda */}
        <g stroke="#0284c7" strokeWidth="1.5">
          <line x1="130" y1="1012" x2="160" y2="1012" />
          <line x1="130" y1="1012" x2="130" y2="982" />
          <circle cx="130" cy="1012" r="2" fill="#0284c7" />
        </g>
        {/* Esquina Inferior Derecha */}
        <g stroke="#0284c7" strokeWidth="1.5">
          <line x1="1790" y1="1012" x2="1760" y2="1012" />
          <line x1="1790" y1="1012" x2="1790" y2="982" />
          <circle cx="1790" cy="1012" r="2" fill="#0284c7" />
        </g>
      </svg>

      {/* 2. Reflejo Diagonal Suave de Cristal (Glass Glare) */}
      <div
        className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 25%, transparent 55%, rgba(2,132,199,0.03) 100%)",
        }}
      />
    </div>
  );
}

export default CupolaFrame;
