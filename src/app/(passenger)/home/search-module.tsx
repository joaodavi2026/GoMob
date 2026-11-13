"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPointParam } from "@/features/routes/points";
import { useAds } from "@/features/ads/ads";
import { PlaceSearch } from "@/features/routes/ui/place-search";
import type { GeoPoint } from "@/types/transit";

/** Busca da Início: o mesmo componente da tela Rotas, com o botão Buscar rotas em largura total. */
export function SearchModule() {
  const router = useRouter();
  const ads = useAds();
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [destination, setDestination] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !destination) return setError("Escolha a origem e o destino na lista de sugestões.");
    if (Math.abs(origin.latitude - destination.latitude) < 1e-5 && Math.abs(origin.longitude - destination.longitude) < 1e-5)
      return setError("A origem e o destino são o mesmo lugar.");
    const qs = new URLSearchParams({ o: formatPointParam(origin), d: formatPointParam(destination) });
    const href = `/routes?${qs.toString()}`;
    router.prefetch(href);
    // no plano gratuito o anúncio vem antes do resultado; ao pular, a pessoa cai direto nas rotas
    ads.request(() => router.push(href));
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4">
      <PlaceSearch
        origin={origin}
        destination={destination}
        onOrigin={(p) => {
          setOrigin(p);
          setError(null);
        }}
        onDestination={(p) => {
          setDestination(p);
          setError(null);
        }}
      >
        {error && (
          <p role="alert" className="mx-2 mt-2 text-sm font-medium text-risk-high">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-2 w-full rounded-[22px] text-base shadow-float">
          <Search className="h-5 w-5" aria-hidden />
          Buscar rotas
        </Button>
      </PlaceSearch>
    </form>
  );
}
