"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, Brain, Heart } from "lucide-react";
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
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary-pressed hover:underline">
          {linkLabel ?? "See all"} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

const unavailable = "Live data is temporarily unavailable.";

export function FavoriteJourneys() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => apiFetch<{ favorites: FavoriteItem[] }>("/api/favorites"), retry: 0 });
  const favs = q.data?.favorites ?? [];

  return (
    <section aria-labelledby="fav-h">
      <div id="fav-h">
        <SectionHeader title="Your favorite journeys" href="/favorites" />
      </div>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState message="We could not load your favorites right now." onRetry={() => q.refetch()} />
      ) : favs.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8" aria-hidden />}
          title="No favorite journeys yet"
          description="Search a route and save it to jump back to it in one tap."
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
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left shadow-soft transition-colors hover:border-primary/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
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
        <SectionHeader title="Explore bus lines" href="/map" linkLabel="Open map" />
      </div>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState message={unavailable} onRetry={() => q.refetch()} />
      ) : lines.length === 0 ? (
        <EmptyState title="No bus lines available" description="Bus lines will appear here as soon as the data source responds." />
      ) : (
        <ul className="space-y-2">
          {lines.slice(0, 5).map((l) => (
            <li key={l.id}>
              <BusCard
                code={l.displayCode}
                name={l.name}
                meta={`Direction ${l.direction}`}
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
    <section aria-labelledby="alerts-h">
      <div id="alerts-h">
        <SectionHeader title="Live bus updates" />
      </div>
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState message={unavailable} onRetry={() => q.refetch()} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={<BellRing className="h-8 w-8" aria-hidden />} title="No active alerts" description="Everything looks calm right now." />
      ) : (
        <ul className="space-y-2">
          {alerts.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Card className="p-3">
                <div className="flex items-start gap-3">
                  <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{a.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{timeAgo(a.createdAt).replace("Last updated", "Posted")}</span>
                      {a.isDemo && <DemoBadge label="Demo" />}
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
    <section aria-labelledby="intel-h">
      <div id="intel-h">
        <SectionHeader title="GoMob Intelligence" href="/predict" linkLabel="Predict" />
      </div>
      {loading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : failed ? (
        <ErrorState message="Crowding insights are temporarily unavailable." onRetry={() => (lines.isError ? lines.refetch() : risk.refetch())} />
      ) : !first || !risk.data ? (
        <EmptyState icon={<Brain className="h-8 w-8" aria-hidden />} title="No insights yet" description="Insufficient data to estimate crowding risk." />
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">
              Line {first.displayCode} · {first.name}
            </p>
            <Badge tone="neutral">{risk.data.risk.source === "DEMO" ? "Demo estimate" : risk.data.risk.source === "OFFICIAL" ? "Official data" : "Derived estimate"}</Badge>
          </div>
          <RiskIndicator className="mt-3" level={risk.data.risk.level} score={risk.data.risk.score} />
          <p className="mt-3 text-sm text-muted">{risk.data.risk.explanation}</p>
          <p className="mt-2 text-xs text-muted">
            {risk.data.risk.confidence != null ? `Confidence ${Math.round(risk.data.risk.confidence * 100)}% · ` : ""}
            {timeAgo(risk.data.risk.calculatedAt)}
          </p>
          <Link
            href="/predict"
            className="mt-3 inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas"
          >
            Predict a future trip
          </Link>
        </Card>
      )}
    </section>
  );
}
