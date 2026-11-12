"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Brain, ChevronRight, Heart } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { BusCard } from "@/components/ui/cards";
import { RiskIndicator, timeAgo } from "@/components/ui/indicators";
import { Badge, Card, DemoBadge, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import type { RiskResult, TransitLine } from "@/types/transit";
import { routesHref } from "./places";

type FavoriteItem = {
  id: string;
  nickname: string;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
};
type AlertItem = { id: string; lineId?: string | null; type: string; title: string; description: string; createdAt: string; isDemo: boolean };
type LinesData = { lines: (TransitLine & { active?: boolean })[]; source?: string; state?: string };

export function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-muted hover:text-ink">
          {linkLabel ?? "Ver tudo"} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-3xl" />
      ))}
    </div>
  );
}

const unavailable = "Os dados ao vivo estão temporariamente indisponíveis.";

export function FavoriteJourneys() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => apiFetch<{ favorites: FavoriteItem[] }>("/api/favorites"), retry: 0 });
  const favs = q.data?.favorites ?? [];

  return (
    <section aria-labelledby="fav-h" className="mt-8">
      <div id="fav-h">
        <SectionHeader title="Viagens favoritas" href="/favorites" />
      </div>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <EmptyState icon={<Heart className="h-6 w-6" aria-hidden />} title="Favoritos indisponíveis" description="As viagens salvas precisam do banco de dados. Enquanto isso, busque uma rota para planejar sua viagem." />
      ) : favs.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8" aria-hidden />}
          title="Nenhuma viagem favorita ainda"
          description="Busque uma rota e salve-a para voltar a ela com um toque."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {favs.slice(0, 4).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    routesHref(
                      { latitude: f.originLatitude, longitude: f.originLongitude, label: f.originLabel },
                      { latitude: f.destinationLatitude, longitude: f.destinationLongitude, label: f.destinationLabel },
                    ),
                  )
                }
                className="tap flex w-full items-center gap-3 rounded-3xl bg-white p-3 text-left shadow-soft"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <Heart className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.nickname}</span>
                  <span className="block truncate text-xs text-muted">
                    {f.originLabel} → {f.destinationLabel}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function useLines() {
  return useQuery({ queryKey: ["lines"], queryFn: () => apiFetch<LinesData>("/api/lines"), retry: 0, staleTime: 60_000 });
}

export function ExploreLines() {
  const router = useRouter();
  const q = useLines();
  const lines = q.data?.lines ?? [];
  return (
    <section aria-labelledby="lines-h">
      <div id="lines-h">
        <SectionHeader title="Explorar linhas de ônibus" href="/map" linkLabel="Abrir mapa" />
      </div>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState message={unavailable} onRetry={() => q.refetch()} />
      ) : lines.length === 0 ? (
        <EmptyState title="Nenhuma linha de ônibus disponível" description="As linhas de ônibus aparecerão aqui assim que a fonte de dados responder." />
      ) : (
        <ul className="space-y-2">
          {lines.slice(0, 5).map((l) => (
            <li key={l.id}>
              <BusCard
                code={l.displayCode}
                name={l.name}
                meta={`Sentido ${l.direction}`}
                isDemo={l.source === "DEMO"}
                onClick={() => router.push(`/map?lineId=${encodeURIComponent(l.id)}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LiveUpdates() {
  const q = useQuery({ queryKey: ["alerts"], queryFn: () => apiFetch<{ alerts: AlertItem[] }>("/api/alerts"), retry: 0, refetchInterval: 60_000 });
  const alerts = q.data?.alerts ?? [];
  return (
    <section aria-labelledby="alerts-h" id="updates" className="mt-8 scroll-mt-4">
      <div id="alerts-h">
        <SectionHeader title="Avisos ao vivo" />
      </div>
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState message={unavailable} onRetry={() => q.refetch()} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={<BellRing className="h-8 w-8" aria-hidden />} title="Nenhum aviso ativo" description="Tudo tranquilo por enquanto." />
      ) : (
        <ul className="space-y-2">
          {alerts.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary"><BellRing className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{a.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{timeAgo(a.createdAt).replace("Atualizado", "Publicado")}</span>
                      {a.isDemo && <DemoBadge label="Demonstração" />}
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function IntelligenceCard() {
  const lines = useLines();
  const first = lines.data?.lines?.[0];
  const risk = useQuery({
    queryKey: ["risk", first?.id],
    enabled: !!first,
    retry: 0,
    queryFn: () => apiFetch<{ risk: RiskResult }>(`/api/intelligence/risk?lineId=${encodeURIComponent(first!.id)}`),
  });

  const loading = lines.isPending || (!!first && risk.isPending);
  const failed = lines.isError || risk.isError;

  return (
    <section aria-labelledby="intel-h" className="mt-8">
      <div id="intel-h">
        <SectionHeader title="Inteligência GoMob" href="/predict" linkLabel="Previsão" />
      </div>
      {loading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : failed ? (
        <ErrorState message="As análises de lotação estão temporariamente indisponíveis." onRetry={() => (lines.isError ? lines.refetch() : risk.refetch())} />
      ) : !first || !risk.data ? (
        <EmptyState icon={<Brain className="h-8 w-8" aria-hidden />} title="Ainda sem análises" description="Dados insuficientes para estimar o risco de lotação." />
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">
              Linha {first.displayCode} · {first.name}
            </p>
            <Badge tone="neutral">{risk.data.risk.source === "DEMO" ? "Estimativa de demonstração" : risk.data.risk.source === "OFFICIAL" ? "Dados oficiais" : "Estimativa derivada"}</Badge>
          </div>
          <RiskIndicator className="mt-3" level={risk.data.risk.level} score={risk.data.risk.score} />
          <p className="mt-3 text-sm text-muted">{risk.data.risk.explanation}</p>
          <p className="mt-2 text-xs text-muted">
            {risk.data.risk.confidence != null ? `Confiança ${Math.round(risk.data.risk.confidence * 100)}% · ` : ""}
            {timeAgo(risk.data.risk.calculatedAt)}
          </p>
          <Link
            href="/predict"
            className="tap mt-4 inline-flex h-11 items-center rounded-full bg-night px-5 text-sm font-semibold text-white"
          >
            Prever uma viagem futura
          </Link>
        </Card>
      )}
    </section>
  );
}
