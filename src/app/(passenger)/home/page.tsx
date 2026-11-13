import type { Metadata } from "next";
import { AccessibilityBanner, BigActions } from "./a11y-blocks";
import { FareStrip, HomeHeader, HomeTitle, MapPreview, ModePills, NetworkHero, PopularLines, RailLines } from "./home-blocks";
import { SearchModule } from "./search-module";
import { FavoriteJourneys, IntelligenceCard, LiveUpdates } from "./sections";
import { AskGobi } from "@/features/assistant/gobi";
import { Around } from "@/features/lines/around";
import { PremiumTeaser } from "@/features/premium/premium-teaser";

export const metadata: Metadata = { title: "Início" };

/**
 * Ordem pensada para quem está na rua: buscar a viagem primeiro, depois pontos próximos e favoritos.
 * Blocos com a classe a11y-hide-simple somem no "Modo simples" (Acessibilidade).
 */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-xl">
      <HomeHeader />
      <HomeTitle />
      <SearchModule />
      <AskGobi className="mt-4" />
      <AccessibilityBanner />
      <BigActions />
      <Around />
      <FavoriteJourneys />
      <PremiumTeaser className="mt-5" />
      <div className="a11y-hide-simple">
        <ModePills />
        <NetworkHero />
        <FareStrip />
        <PopularLines />
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
