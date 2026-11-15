import type { Metadata } from "next";
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
    <div className="relative min-h-screen bg-white text-[#0A0E17]">
      <Hero />
      <div id="dashboard" className="relative min-h-screen bg-white">
        <AtlasApp initialExperiments={experiments} mode={mode} />
      </div>
    </div>
  );
}
