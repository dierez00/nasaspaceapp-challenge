"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MicrogravityFlame } from "./MicrogravityFlame";
import { CupolaFrame } from "./CupolaFrame";
import { ScrollIndicator } from "./ScrollIndicator";
import { LanguageToggle } from "@/shared/i18n/language-toggle";
import { useT } from "@/shared/i18n/locale";

// Registrar ScrollTrigger de forma segura en cliente
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// Carga dinámica de SpaceBackdrop3D con ssr: false para garantizar WebGL limpio en cliente
const SpaceBackdrop3D = dynamic(
  () => import("./SpaceBackdrop3D").then((mod) => mod.SpaceBackdrop3D),
  { ssr: false }
);

export function HeroSection() {
  const t = useT();
  const heroWrapperRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cupolaRef = useRef<HTMLDivElement>(null);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLDivElement>(null);
  const gradientOverlayRef = useRef<HTMLDivElement>(null);
  const bottomGradientSeamRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // -------------------------------------------------------------
      // 1. ANIMACIÓN DE ENTRADA SUAVE (Siempre visible desde el inicio)
      // -------------------------------------------------------------
      gsap.from(".hero-title-text", {
        opacity: 0.4,
        y: 20,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.15,
        clearProps: "transform,opacity",
      });

      // Llama de microgravedad en el fondo central
      if (flameRef.current) {
        gsap.from(flameRef.current, {
          scale: 0.8,
          opacity: 0.5,
          duration: 1.4,
          ease: "expo.out",
          clearProps: "transform,opacity",
        });
      }

      // -------------------------------------------------------------
      // 2. TIMELINE DE SCROLL: UN SOLO DESLIZAMIENTO SENCILLO (SIN PIN)
      //    Paralaje cinemático fluido + degradado continuo al Laboratorio
      // -------------------------------------------------------------
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: heroWrapperRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.75,
          invalidateOnRefresh: true,
        },
      });

      // A) El título asciende suavemente con paralaje elegante sin salirse del visor
      if (titleContainerRef.current) {
        scrollTl.to(
          titleContainerRef.current,
          {
            yPercent: -28,
            opacity: 0.1,
            ease: "power1.out",
          },
          0
        );
      }

      // B) Cúpula: efecto de profundidad sutil hacia afuera
      if (cupolaRef.current) {
        scrollTl.to(
          cupolaRef.current,
          {
            scale: 1.35,
            opacity: 0.25,
            ease: "power1.out",
          },
          0
        );
      }

      // C) Fondo 3D: ligero paralaje de cámara
      if (backdropRef.current) {
        scrollTl.to(
          backdropRef.current,
          {
            scale: 1.12,
            ease: "none",
          },
          0
        );
      }

      // D) Llama central: asciende con suavidad
      if (flameRef.current) {
        scrollTl.to(
          flameRef.current,
          {
            yPercent: -18,
            scale: 0.88,
            opacity: 0.2,
            ease: "power1.out",
          },
          0
        );
      }

      // E) Degradado continuo hacia el Laboratorio:
      if (gradientOverlayRef.current) {
        scrollTl.to(
          gradientOverlayRef.current,
          {
            opacity: 1,
            ease: "power1.inOut",
          },
          0
        );
      }

      // F) Costura inferior que funde el fondo espacial con el blanco del #dashboard
      if (bottomGradientSeamRef.current) {
        scrollTl.to(
          bottomGradientSeamRef.current,
          {
            opacity: 1,
            scaleY: 1.3,
            ease: "power1.out",
          },
          0
        );
      }
    },
    { scope: heroWrapperRef }
  );

  return (
    <div
      ref={heroWrapperRef}
      className="relative w-full bg-[#02040a] text-white overflow-hidden"
    >
      <section className="h-screen w-full relative overflow-hidden flex items-center justify-center px-4 sm:px-8 select-none">
        {/* 1. Capa 3D de Fondo (z-0): Skybox de estrellas, Tierra lejana y Luna */}
        <div
          ref={backdropRef}
          className="absolute inset-0 z-0 origin-center pointer-events-none"
        >
          <SpaceBackdrop3D />
        </div>

        {/* 2. Capa de Superposición de Escotilla (z-20): Marco de cúpula blanco aeroespacial y biseles */}
        <div
          ref={cupolaRef}
          className="absolute inset-0 z-20 pointer-events-none origin-center will-change-transform"
        >
          <CupolaFrame />
        </div>

        {/* 2.1 Logotipo ATLAS (Esquina Superior Izquierda, z-30) */}
        <div className="absolute top-4 sm:top-6 left-6 sm:left-10 z-30 pointer-events-auto">
          <div className="flex items-center gap-2.5 select-none">
            <div className="relative grid place-items-center w-8 h-8 sm:w-9 sm:h-9 border border-[#0b3d91] rounded-full shrink-0 bg-white/70 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
              <span className="font-serif italic text-xl sm:text-2xl text-[#0b3d91] leading-none select-none">
                a
              </span>
              <span className="absolute -top-1 -right-0.5 text-[9px] font-sans font-bold text-[#0b3d91] bg-white px-0.5 select-none rounded-full">
                ✦
              </span>
              <span className="absolute w-11 h-2.5 border border-[#0b3d91] rounded-full -rotate-[40deg] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 2.2 Logotipo NASA (Esquina Superior Derecha, z-30) con el selector EN | ES */}
        <div className="absolute top-4 sm:top-6 right-6 sm:right-10 z-30 pointer-events-auto flex items-center gap-3">
          <LanguageToggle />
          <Image
            src="/NASA_logo.webp"
            alt="NASA"
            width={64}
            height={36}
            className="h-8 sm:h-9 w-auto object-contain select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
            priority
          />
        </div>

        {/* 3. Llama Esférica de Difusión en Microgravedad (z-10): Centrada como aura luminosa */}
        <div
          ref={flameRef}
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none origin-center will-change-transform"
        >
          <MicrogravityFlame />
        </div>

        {/* 4. TÍTULO MONUMENTAL (z-30): Letras Grandes siempre visibles y centradas */}
        <div
          ref={titleContainerRef}
          className="relative z-30 text-center w-full max-w-6xl mx-auto flex flex-col items-center justify-center pointer-events-none will-change-transform py-6"
        >
          <h1 className="w-full flex flex-col items-center justify-center font-black uppercase tracking-[0.2em] leading-tight select-none drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)] drop-shadow-[0_0_40px_rgba(56,189,248,0.4)]">
            <span
              className="hero-title-text inline-block font-black text-center text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-cyan-100 opacity-100 text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            >
              {t("LUNAR FIRE", "ATLAS DEL FUEGO")}
            </span>
            <span
              className="hero-title-text inline-block font-black text-center text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-sky-300 tracking-[0.28em] mt-1 sm:mt-2 opacity-100 text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            >
              {t("ATLAS", "LUNAR")}
            </span>
          </h1>
        </div>

        {/* 5. Indicador Futurista fijado en la parte inferior de la pantalla */}
        <div className="absolute bottom-20 sm:bottom-28 left-0 right-0 z-30 flex flex-col items-center pointer-events-auto">
          <ScrollIndicator />
        </div>

        {/* 6. DEGRADADO ESPACIAL CONTINUO HACIA EL LABORATORIO (Overlay cinemático) */}
        <div
          ref={gradientOverlayRef}
          className="absolute inset-0 pointer-events-none z-25 opacity-0 will-change-opacity"
          style={{
            background:
              "linear-gradient(180deg, rgba(2, 4, 10, 0) 0%, rgba(2, 4, 10, 0.25) 35%, rgba(10, 14, 23, 0.75) 65%, rgba(14, 165, 233, 0.12) 82%, rgba(255, 255, 255, 0.95) 96%, #ffffff 100%)",
          }}
        />

        {/* 7. Costura inferior de transición perfecta al fondo blanco del #dashboard */}
        <div
          ref={bottomGradientSeamRef}
          className="absolute -bottom-1 left-0 right-0 h-44 pointer-events-none z-28 opacity-0 origin-bottom will-change-transform"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.6) 50%, #ffffff 100%)",
          }}
        />
      </section>
    </div>
  );
}

export default HeroSection;
