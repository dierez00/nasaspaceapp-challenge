import type { Metadata } from "next";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { SmoothScrollProvider } from "@/components/common/SmoothScrollProvider";
import { Hero } from "./_components/hero";
import { AtlasApp } from "@/modules/atlas/ui/atlas-app";
import { DemoExperimentRepository } from "@/modules/atlas/infra/experiments";

export const metadata: Metadata = {
  title: { absolute: "Lunar Fire Atlas | Combustion explorer" },
  description:
    "Explore how gravity, pressure and oxygen transform fire. An interactive lunar research demo.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const mode = process.env.ATLAS_DATA_MODE === "remote" ? "remote" : "demo";
  const experiments =
    mode === "demo" ? await new DemoExperimentRepository().list() : [];

  return (
    <SmoothScrollProvider>
      <div className="relative min-h-screen bg-white text-[#0A0E17]">
        <LoadingScreen />
        <Hero />
        <div id="dashboard" className="relative min-h-screen bg-white">
          <AtlasApp initialExperiments={experiments} mode={mode} />
        </div>
      </div>
    </SmoothScrollProvider>
  );
}
