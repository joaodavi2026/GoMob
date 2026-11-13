"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Accessibility, CalendarClock, Clock, Radio } from "lucide-react";
import { BottomSheet, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Arrival, Scheduled, StopArrivals } from "@/features/network/arrivals";
import { LineBadge } from "./line-badge";

export type { StopArrivals };

const lineHref = (code: string) => `/lines/${encodeURIComponent(code)}`;

/** "13 min" em destaque, como um painel de ponto de ônibus. */
export function MinutesChip({ minutes, time }: { minutes: number; time?: string }) {
  const now = minutes <= 0;
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-extrabold", now ? "bg-risk-low text-white" : "bg-primary-light text-primary-pressed")}>
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {now ? "Agora" : `${minutes} min`}
      </span>
      {time && <span className="mt-0.5 text-[11px] font-semibold text-muted">{time}</span>}
    </span>
  );
}

export function ArrivalRow({ a, onNavigate }: { a: Arrival; onNavigate?: () => void }) {
  return (
    <li>
      <Link href={lineHref(a.code)} onClick={onNavigate} className="flex items-center gap-3 py-3">
        <LineBadge code={a.code} color={a.color} type={3} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-bold leading-snug text-ink">{a.headsign}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Radio className="h-3 w-3 text-risk-low" aria-hidden /> Tempo real
            </span>
            {a.accessible && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Accessibility className="h-3 w-3" aria-hidden /> acessível
              </span>
            )}
          </span>
        </span>
        <MinutesChip minutes={a.minutes} time={a.time} />
      </Link>
    </li>
  );
}

function ScheduledRow({ s, onNavigate }: { s: Scheduled; onNavigate?: () => void }) {
  const body = (
    <>
      <LineBadge code={s.code} color={s.color} type={s.type} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold leading-snug text-ink">{s.headsign}</span>
        <span className="text-[11px] text-muted">Horário programado</span>
      </span>
      <span className={cn("shrink-0 rounded-lg px-2 py-1 text-xs font-bold", s.running ? "bg-canvas text-ink" : "bg-canvas text-muted")}>{s.running ? (s.headway ? `a cada ~${s.headway} min` : "em operação") : `volta às ${s.first ?? "—"}`}</span>
    </>
  );
  // linhas de trilhos usam o número no selo; o link precisa do código do GTFS, que só os ônibus mostram
  return <li>{s.type === 3 ? <Link href={lineHref(s.code)} onClick={onNavigate} className="flex items-center gap-3 py-2.5">{body}</Link> : <div className="flex items-center gap-3 py-2.5">{body}</div>}</li>;
}

export function ArrivalsBoard({ data, limit, onNavigate }: { data: StopArrivals; limit?: number; onNavigate?: () => void }) {
  const arrivals = limit ? data.arrivals.slice(0, limit) : data.arrivals;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted" role="status">
        {data.state === "LIVE" ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-risk-low" aria-hidden /> Previsão em tempo real da SPTrans · {data.clock}
          </>
        ) : (
          <>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Sem previsão em tempo real agora: mostrando o horário programado
          </>
        )}
      </p>
      {arrivals.length > 0 && (
        <ul className="mt-1 divide-y divide-border" aria-label="Próximas chegadas">
          {arrivals.map((a, i) => (
            <ArrivalRow key={`${a.code}-${a.prefix}-${i}`} a={a} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
      {data.state === "LIVE" && arrivals.length === 0 && <p className="mt-2 rounded-2xl bg-canvas px-3 py-2 text-sm text-muted">Nenhum ônibus a caminho deste ponto agora.</p>}
      {!limit && data.scheduled.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-extrabold text-ink">{arrivals.length ? "Outras linhas neste ponto" : "Linhas neste ponto"}</h3>
          <ul className="divide-y divide-border">
            {data.scheduled.map((s) => (
              <ScheduledRow key={`${s.code}-${s.headsign}`} s={s} onNavigate={onNavigate} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Painel de um ponto: próximas chegadas (atualiza a cada 20 s). */
export function StopSheet({ stopId, name, onClose }: { stopId: string | null; name?: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["stop-arrivals", stopId],
    enabled: !!stopId,
    refetchInterval: 20_000,
    queryFn: () => apiFetch<StopArrivals>(`/api/stops/${encodeURIComponent(stopId!)}/arrivals`),
  });
  if (!stopId) return null;
  return (
    <BottomSheet open onClose={onClose} title={q.data?.stop.name ?? name ?? "Ponto"} description="Próximas chegadas neste ponto">
      {q.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ) : q.isError || !q.data ? (
        <p className="rounded-2xl bg-canvas px-3 py-3 text-sm text-muted">Não foi possível carregar as chegadas deste ponto agora.</p>
      ) : (
        <ArrivalsBoard data={q.data} onNavigate={onClose} />
      )}
    </BottomSheet>
  );
}
