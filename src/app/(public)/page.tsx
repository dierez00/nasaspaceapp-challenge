import { Hero } from "./_components/hero";
import { Dashboard } from "./_components/dashboard";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#02040a] text-slate-100">
      <Hero />
      <Dashboard />
    </main>
  );
}
