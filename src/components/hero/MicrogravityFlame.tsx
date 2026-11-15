"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "@/components/common/useReducedMotion";

// A microgravity flame is a blue sphere, not a teardrop: with no buoyancy the reaction
// front spreads evenly in every direction. Palette: Blue Flame (#3B82F6) over Cabin Night.
export function MicrogravityFlame({ paused = false }: { paused?: boolean }) {
  const flameRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = flameRef.current;
    if (!el) return;
    // Static when motion is reduced or the cabin is not the visible surface.
    if (reducedMotion || paused) {
      el.style.removeProperty("transform");
      return;
    }

    let animationFrameId: number;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const t = (currentTime - startTime) * 0.001;
      // Slow drift from detuned harmonics, bounded to a few pixels.
      const x = Math.sin(t * 0.65) * 3 + Math.cos(t * 1.25) * 1.6;
      const y = Math.cos(t * 0.75) * 3.4 + Math.sin(t * 1.15) * 1.6;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [reducedMotion, paused]);

  return (
    <div
      ref={flameRef}
      className="relative grid h-[112px] w-[112px] place-items-center select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* All soft edges come from gradients, not blur filters, so the sphere stays crisp
          and cheap while the dive scales it. */}
      <div
        className="absolute h-[260px] w-[260px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.34) 0%, rgba(59,130,246,0.14) 32%, rgba(59,130,246,0.04) 52%, transparent 68%)",
        }}
      />
      <div
        className="absolute h-[92px] w-[92px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(219,234,254,0.95) 0%, rgba(147,197,253,0.85) 28%, rgba(59,130,246,0.9) 58%, rgba(29,78,216,0.85) 80%, rgba(29,78,216,0) 100%)",
        }}
      />
      <div
        className="absolute h-[64px] w-[64px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(219,234,254,0.4) 55%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default MicrogravityFlame;
