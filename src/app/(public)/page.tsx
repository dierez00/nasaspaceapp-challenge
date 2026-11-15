import type { Metadata } from "next";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { SmoothScrollProvider } from "@/components/common/SmoothScrollProvider";
import { Hero } from "./_components/hero";
import { AtlasApp } from "@/modules/atlas/ui/atlas-app";
import { DemoExperimentRepository } from "@/modules/atlas/infra/experiments";

export const metadata: Metadata = {
  title: { absolute: "Atlas del Fuego Lunar | Explorador de combustión" },
  description:
    "Explora cómo la gravedad, la presión y el oxígeno transforman el fuego. Demo interactiva de investigación lunar.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const mode = process.env.ATLAS_DATA_MODE === "remote" ? "remote" : "demo";
  const experiments =
    mode === "demo" ? await new DemoExperimentRepository().list() : [];

  return (
    <SmoothScrollProvider>
      <div className="relative min-h-screen bg-white text-[#0A0E17]">
        <a
          href="#dashboard"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#0B3D91] focus:shadow-[0_12px_36px_-8px_rgba(10,14,23,0.08)] focus:outline-2 focus:outline-offset-2 focus:outline-[#0B3D91]"
        >
          Saltar al Atlas
        </a>
        <LoadingScreen />
        <Hero />
        <div id="dashboard" tabIndex={-1} className="relative min-h-screen bg-white outline-none">
          <AtlasApp initialExperiments={experiments} mode={mode} />
        </div>
      </div>
    </SmoothScrollProvider>
  );
}
