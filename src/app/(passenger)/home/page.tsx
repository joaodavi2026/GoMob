import type { Metadata } from "next";
import { SearchModule } from "./search-module";
import { ExploreLines, FavoriteJourneys, IntelligenceCard, LiveUpdates } from "./sections";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-primary to-primary-pressed p-5 pb-20 text-white shadow-soft sm:p-8 sm:pb-24">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">Where are we going today?</h1>
        <p className="mt-2 text-base text-white/90 sm:text-lg">Find smarter bus routes across São Paulo.</p>
      </section>

      <div className="-mt-14 px-1 sm:-mt-16 sm:px-3">
        <SearchModule />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <FavoriteJourneys />
          <ExploreLines />
        </div>
        <div className="space-y-8">
          <LiveUpdates />
          <IntelligenceCard />
        </div>
      </div>
    </div>
  );
}
