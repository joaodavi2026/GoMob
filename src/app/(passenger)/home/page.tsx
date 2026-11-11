import type { Metadata } from "next";
import { AccessibilityBanner, BigActions } from "./a11y-blocks";
import { FareStrip, HomeHeader, HomeTitle, MapPreview, ModePills, NetworkHero, PopularLines, RailLines } from "./home-blocks";
import { SearchModule } from "./search-module";
import { FavoriteJourneys, IntelligenceCard, LiveUpdates } from "./sections";

export const metadata: Metadata = { title: "Home" };

/** Blocos com a classe a11y-hide-simple somem no "Modo simples" (Acessibilidade). */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-xl">
      <HomeHeader />
      <HomeTitle />
      <AccessibilityBanner />
      <BigActions />
      <SearchModule />
      <div className="a11y-hide-simple">
        <ModePills />
        <NetworkHero />
        <FareStrip />
        <PopularLines />
      </div>
      <FavoriteJourneys />
      <div className="a11y-hide-simple">
        <RailLines />
        <MapPreview />
      </div>
      <LiveUpdates />
      <div className="a11y-hide-simple">
        <IntelligenceCard />
      </div>
    </div>
  );
}
