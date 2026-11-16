"use client";

import React from "react";

// Conjunto determinista de coordenadas estelares para renderizado consistente y nítido
const STARS = [
  { x: 5, y: 12, s: 1.2, anim: "animate-star-slow", opacity: 0.8 },
  { x: 12, y: 28, s: 1.8, anim: "animate-star-fast", opacity: 0.9 },
  { x: 18, y: 8, s: 1.0, anim: "animate-star-medium", opacity: 0.7 },
  { x: 25, y: 34, s: 2.2, anim: "animate-star-slow", opacity: 0.95 },
  { x: 31, y: 16, s: 1.4, anim: "animate-star-medium", opacity: 0.6 },
  { x: 38, y: 42, s: 0.8, anim: "animate-star-fast", opacity: 0.5 },
  { x: 44, y: 19, s: 1.6, anim: "animate-star-slow", opacity: 0.85 },
  { x: 52, y: 7, s: 2.0, anim: "animate-star-medium", opacity: 0.9 },
  { x: 58, y: 31, s: 1.2, anim: "animate-star-fast", opacity: 0.75 },
  { x: 64, y: 14, s: 1.0, anim: "animate-star-slow", opacity: 0.65 },
  { x: 71, y: 24, s: 1.7, anim: "animate-star-medium", opacity: 0.8 },
  { x: 77, y: 9, s: 1.3, anim: "animate-star-fast", opacity: 0.7 },
  { x: 84, y: 38, s: 2.4, anim: "animate-star-slow", opacity: 0.9 },
  { x: 89, y: 18, s: 1.1, anim: "animate-star-medium", opacity: 0.6 },
  { x: 94, y: 29, s: 1.5, anim: "animate-star-fast", opacity: 0.85 },
  { x: 8, y: 55, s: 1.3, anim: "animate-star-medium", opacity: 0.7 },
  { x: 22, y: 62, s: 0.9, anim: "animate-star-slow", opacity: 0.55 },
  { x: 35, y: 58, s: 1.6, anim: "animate-star-fast", opacity: 0.8 },
  { x: 68, y: 52, s: 2.0, anim: "animate-star-slow", opacity: 0.85 },
  { x: 82, y: 64, s: 1.2, anim: "animate-star-medium", opacity: 0.6 },
  { x: 92, y: 58, s: 1.7, anim: "animate-star-fast", opacity: 0.8 },
];

export function SpaceBackdrop() {
  return (
    <div className="absolute inset-0 w-full h-full bg-[#02040a] overflow-hidden pointer-events-none select-none">
      {/* 1. Resplandor Cósmico y Nebulosa Frecuencial Profunda */}
      <div 
        className="absolute top-0 right-1/4 w-[750px] h-[550px] rounded-full opacity-30 blur-[130px]"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 75%)"
        }}
      />
      <div 
        className="absolute bottom-1/4 left-1/3 w-[600px] h-[450px] rounded-full opacity-25 blur-[120px]"
        style={{
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%)"
        }}
      />

      {/* 2. Campo de Estrellas Vectoriales Nítidas */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="starGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {STARS.map((star, idx) => (
          <circle
            key={idx}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.s}
            fill="#ffffff"
            opacity={star.opacity}
            className={star.anim}
            filter={star.s > 1.8 ? "url(#starGlow)" : undefined}
          />
        ))}
      </svg>

      {/* 3. La Tierra Lejana (Esquina Superior Derecha) */}
      <div className="absolute top-10 right-10 sm:top-14 sm:right-16 md:top-16 md:right-24 z-10">
        <div className="relative w-14 h-14 sm:w-16 sm:h-16">
          {/* Halo atmosférico exterior difuminado */}
          <div className="absolute inset-0 rounded-full blur-md bg-sky-400/30 scale-125" />
          
          <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-[0_0_14px_rgba(56,189,248,0.55)]">
            <defs>
              <radialGradient id="earthAtmosphere" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#bae6fd" />
                <stop offset="25%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#0284c7" />
                <stop offset="85%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#082f49" />
              </radialGradient>
              <linearGradient id="cloudGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Disco planetario base */}
            <circle cx="50" cy="50" r="46" fill="url(#earthAtmosphere)" />

            {/* Siluetas abstractas continentales y de nubes */}
            <path
              d="M 30,30 Q 42,22 55,28 T 68,44 Q 62,56 46,50 T 26,42 Z"
              fill="#059669"
              opacity="0.45"
            />
            <path
              d="M 40,55 Q 52,50 62,60 T 56,76 Q 44,78 36,68 Z"
              fill="#047857"
              opacity="0.4"
            />
            <path
              d="M 22,35 Q 36,40 50,32 T 75,38 Q 65,46 45,42 T 24,40 Z"
              fill="url(#cloudGlow)"
            />
            <path
              d="M 32,60 Q 48,58 60,66 T 70,72 Q 52,74 38,66 Z"
              fill="url(#cloudGlow)"
            />

            {/* Sombra del terminador noche/día */}
            <path
              d="M 50,4 A 46,46 0 0,1 96,50 A 46,46 0 0,1 50,96 A 46,46 0 0,0 50,4 Z"
              fill="#020617"
              opacity="0.65"
            />
          </svg>
        </div>
      </div>

      {/* 4. El Horizonte Lunar (Ocupando todo el ancho inferior) */}
      <div className="absolute bottom-0 left-0 right-0 w-full z-10 pointer-events-none">
        <svg
          viewBox="0 0 1440 280"
          className="w-full h-auto block"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente de superficie lunar: basalto y regolito */}
            <linearGradient id="lunarSurface" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="25%" stopColor="#131c2e" />
              <stop offset="60%" stopColor="#0b111e" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>

            {/* Brillo frío de cresta lunar (rim lighting por el sol rasante) */}
            <linearGradient id="lunarRimLight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" />
              <stop offset="25%" stopColor="#cbd5e1" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#f8fafc" stopOpacity="0.95" />
              <stop offset="75%" stopColor="#94a3b8" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.25" />
            </linearGradient>

            {/* Sombra de cráteres */}
            <radialGradient id="craterShadow" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#030712" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#0f172a" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#334155" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* Curvatura principal del cuerpo lunar */}
          <path
            d="M 0,140 Q 720,40 1440,140 L 1440,280 L 0,280 Z"
            fill="url(#lunarSurface)"
          />

          {/* Línea de horizonte con resplandor óptico */}
          <path
            d="M 0,140 Q 720,40 1440,140"
            fill="none"
            stroke="url(#lunarRimLight)"
            strokeWidth="2.5"
            style={{
              filter: "drop-shadow(0 -3px 12px rgba(226, 232, 240, 0.45))",
            }}
          />

          {/* Cráteres estilizados y detalles de regolito */}
          {/* Cráter Principal Central */}
          <g transform="translate(680, 105)">
            <ellipse cx="40" cy="18" rx="48" ry="14" fill="url(#craterShadow)" stroke="#475569" strokeWidth="1" opacity="0.85" />
            <path d="M -8,18 Q 40,8 88,18" fill="none" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />
          </g>

          {/* Cráter Occidental */}
          <g transform="translate(260, 135)">
            <ellipse cx="25" cy="12" rx="32" ry="9" fill="url(#craterShadow)" stroke="#334155" strokeWidth="0.8" opacity="0.75" />
            <path d="M -7,12 Q 25,6 57,12" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
          </g>

          {/* Cráter Oriental */}
          <g transform="translate(1080, 138)">
            <ellipse cx="30" cy="14" rx="42" ry="11" fill="url(#craterShadow)" stroke="#334155" strokeWidth="0.8" opacity="0.7" />
            <path d="M -12,14 Q 30,7 72,14" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.45" />
          </g>

          {/* Pequeños impactos de meteorito */}
          <ellipse cx="480" cy="148" rx="14" ry="5" fill="url(#craterShadow)" opacity="0.6" />
          <ellipse cx="920" cy="154" rx="18" ry="6" fill="url(#craterShadow)" opacity="0.6" />
          <ellipse cx="120" cy="175" rx="22" ry="7" fill="url(#craterShadow)" opacity="0.5" />
          <ellipse cx="1320" cy="180" rx="20" ry="6" fill="url(#craterShadow)" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

