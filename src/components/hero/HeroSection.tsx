"use client";

import React, { type RefObject } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AtlasMark } from "@/components/brand/atlas-mark";
import { MicrogravityFlame } from "./MicrogravityFlame";
import { CupolaFrame } from "./CupolaFrame";

// Client-only: WebGL must never run during SSR.
const SpaceBackdrop3D = dynamic(
  () => import("./SpaceBackdrop3D").then((mod) => mod.SpaceBackdrop3D),
  { ssr: false },
);

interface HeroSectionProps {
  /** The cabin is the visible surface: the 3D backdrop and the flame render. */
  live: boolean;
  /** Camera dolly progress shared with the transition timeline. */
  dive: RefObject<{ p: number }>;
  onStart: () => void;
  ctaRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The cabin: the ISS cupola window over the Moon. The transition timeline animates the
 * `data-layer` nodes from outside; this component only lays them out.
 */
export function HeroSection({ live, dive, onStart, ctaRef }: HeroSectionProps) {
  return (
    <section
      data-layer="cabin"
      aria-labelledby="cabin-title"
      className="cabin theme-cabin"
    >
      <div className="cabin-backdrop" aria-hidden="true">
        <SpaceBackdrop3D active={live} dive={dive} />
        <div className="cabin-glass" />
      </div>

      <div data-layer="frame" className="cabin-frame">
        <CupolaFrame />
      </div>

      <div className="cabin-mark">
        <AtlasMark className="cabin-mark-logo" />
      </div>
      <Image
        src="/NASA_logo.webp"
        alt="NASA"
        width={64}
        height={36}
        priority
        className="cabin-nasa"
      />

      <div className="cabin-stage">
        <div data-layer="flame" className="cabin-flame">
          <MicrogravityFlame paused={!live} />
        </div>
        <div data-layer="copy" className="cabin-copy">
          <h1 id="cabin-title" className="cabin-title">
            Atlas del fuego lunar
          </h1>
          <p className="cabin-lede">
            Ajusta gravedad, presión y oxígeno, y observa cómo se comporta una
            llama.
          </p>
        </div>
        <button
          ref={ctaRef}
          data-layer="cta"
          type="button"
          className="cabin-cta"
          onClick={onStart}
        >
          Comenzar inmersión
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="cabin-cta-arrow"
          >
            <path
              d="M4 10h11m-4.5-5L15.5 10l-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default HeroSection;
