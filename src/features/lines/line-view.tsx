"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accessibility, ArrowLeft, ArrowLeftRight, BusFront, CalendarClock, ChevronDown, ChevronRight, Info, Navigation, Radio, Share2, Star, X } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { AskGobi } from "@/features/assistant/gobi";
import { brl, daysLabel, useNetwork, type NetDir, type NetLine } from "@/features/network/data";
import { railInfo, titleCase } from "@/features/network/rail";
import { formatPointParam } from "@/features/routes/points";
import { toggleFavoriteLine, useFavoriteLines } from "./favorites";
import { LineBadge } from "./line-badge";
import { dirHeadway, dirRuns } from "./lines-view";
import type { MapStop } from "./line-map";
import { StopSheet } from "./stop-arrivals";

const LineMap = dynamic(() => import("./line-map"), { ssr: false });

type LineStatus = { state: "LIVE" | "UNAVAILABLE"; running: number; accessible: number; vehicles: [number, number, string, number, number][] };
const pad = (n: number) => String(n).padStart(2, "0");

/** Próximas partidas programadas (aproximadas): hora cheia + múltiplos do intervalo daquela hora. */
function nextDepartures(dir: Pick<NetDir, "freq">, minuteNow: number, count: number): string[] {
  const out: string[] = [];
  const hours = [...dir.freq].sort((a, b) => a[0] - b[0]);
  for (const pass of [0, 1440]) {
    for (const [h, every] of hours) {
      if (every <= 0) continue;
      for (let m = h * 60; m < h * 60 + 60; m += every) if (m + pass >= minuteNow && out.length < count) out.push(`${pad(h)}:${pad(m % 60)}`);
      if (out.length >= count) return out;
    }
  }
  return out;
}

export function LineView({ code }: { code: string }) {
  const net = useNetwork();
  const line = useMemo(() => net.data?.lines.find((l) => l.code === code) ?? null, [net.data, code]);

  if (net.isPending) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-2" aria-busy="true">
        <Skeleton className="h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }
  if (net.isError) return <ErrorState message="Não foi possível carregar esta linha agora." onRetry={() => net.refetch()} />;
  if (!line || !net.data) return <EmptyState title="Linha não encontrada" description={`Não achamos a linha ${code} na rede da SPTrans.`} />;
  return <Detail line={line} stopsTable={net.data.stops} />;
}

function Detail({ line, stopsTable }: { line: NetLine; stopsTable: [string, string, number, number][] }) {
  const router = useRouter();
  const toast = useToast();
  const { announce } = useA11y();
  const favs = useFavoriteLines();
  const fav = favs.includes(line.code);
  const rail = railInfo(line.code);
  const isBus = line.type === 3;
  const [dirIndex, setDirIndex] = useState(0);
  const [live, setLive] = useState(isBus);
  const [allStops, setAllStops] = useState(false);
  const [grid, setGrid] = useState(false);
  const [how, setHow] = useState(true);
  const [stopId, setStopId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const dir = line.dirs[Math.min(dirIndex, line.dirs.length - 1)];
  const stops = useMemo<MapStop[]>(() => (dir?.stops ?? []).map((i) => ({ id: stopsTable[i][0], name: stopsTable[i][1], lat: stopsTable[i][2], lon: stopsTable[i][3] })), [dir, stopsTable]);

  const status = useQuery({
    queryKey: ["line-status", line.code, dir?.d],
    enabled: isBus && live && !!dir,
    refetchInterval: 20_000,
    queryFn: () => apiFetch<LineStatus>(`/api/network/line-status?code=${encodeURIComponent(line.code)}&dir=${dir!.d}`),
  });
  const buses = useMemo<[number, number][]>(() => (live ? (status.data?.vehicles ?? []).map((v) => [v[0], v[1]] as [number, number]) : []), [status.data, live]);

  if (!dir) return <EmptyState title="Linha sem trajeto" description="Esta linha não tem paradas cadastradas no GTFS." />;

  const running = dirRuns(dir, now);
  const every = dirHeadway(dir, now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now);
  const next = nextDepartures(dir, Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5)), 3);
  const title = rail ? `Linha ${rail.number}-${rail.name}` : titleCase(line.name);
  const last = stops[stops.length - 1];
  const planHref = last ? `/routes?d=${encodeURIComponent(formatPointParam({ latitude: last.lat, longitude: last.lon, label: last.name }))}` : "/routes";
  const visible = allStops || stops.length <= 9 ? stops : stops.slice(0, 8);

  const share = async () => {
    const url = window.location.href;
    try {
      if ("share" in navigator) await navigator.share({ title: `${isBus ? `Linha ${line.code}` : title} no GoMob`, url });
      else {
        await (navigator as Navigator).clipboard.writeText(url);
        toast.success("Link da linha copiado.");
      }
    } catch {
      // a pessoa fechou o compartilhamento
    }
  };
  const toggleFav = () => {
    const on = toggleFavoriteLine(line.code);
    const msg = on ? "Linha adicionada às favoritas." : "Linha removida das favoritas.";
    toast.success(msg);
    announce(msg);
  };
  const swap = () => {
    const nextIndex = (dirIndex + 1) % line.dirs.length;
    setDirIndex(nextIndex);
    setAllStops(false);
    announce(`Sentido ${titleCase(line.dirs[nextIndex].headsign)}.`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-4 pt-1">
      {/* barra do topo */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Voltar" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <LineBadge code={line.code} color={line.color} type={line.type} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-muted">{rail ? rail.operator : "SPTrans"}</span>
        <button type="button" onClick={share} aria-label="Compartilhar esta linha" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
          <Share2 className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-ink">{title}</h1>

      {/* mapa */}
      <div className="relative h-64 overflow-hidden rounded-3xl bg-white shadow-soft sm:h-80">
        <LineMap stops={stops} color={line.color} buses={buses} selected={stopId} onStop={setStopId} />
        {isBus && (
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            aria-pressed={live}
            className={cn("tap absolute left-3 top-3 z-10 flex h-11 items-center gap-2 rounded-full px-3.5 text-xs font-bold shadow-float", live ? "bg-night text-white" : "bg-white text-ink")}
          >
            <Radio className={cn("h-4 w-4", live && "text-primary")} aria-hidden />
            {!live ? "Mostrar ônibus ao vivo" : status.isPending ? "Buscando ônibus…" : status.data?.state !== "LIVE" ? "Posição indisponível" : `${status.data.running} ônibus ao vivo`}
          </button>
        )}
      </div>

      {/* sentido */}
      <section aria-label="Sentido" className="rounded-3xl bg-white p-4 shadow-soft">
        <p className="text-xs font-semibold text-muted">Sentido</p>
        <p className="break-words text-xl font-extrabold leading-tight text-ink">{titleCase(dir.headsign)}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {line.dirs.length > 1 ? (
            <button type="button" onClick={swap} className="tap inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-light px-4 text-sm font-bold text-primary-pressed">
              <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden /> Trocar sentido
            </button>
          ) : (
            <span />
          )}
          <AskGobi compact line={line.code} title="Pergunte ao Gobi" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link href={planHref} className="tap flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-bold text-white">
            <Navigation className="h-4 w-4" aria-hidden /> Começar
          </Link>
          <button type="button" onClick={toggleFav} aria-pressed={fav} className={cn("tap flex h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold", fav ? "bg-primary-light text-primary-pressed" : "bg-canvas text-ink")}>
            <Star className={cn("h-4 w-4", fav && "fill-primary text-primary")} aria-hidden /> {fav ? "Favorita" : "Favorito"}
          </button>
          <Link href={isBus ? `/network?line=${encodeURIComponent(line.code)}` : "/network"} className="tap flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-canvas text-sm font-bold text-ink">
            <BusFront className="h-4 w-4" aria-hidden /> Na rede
          </Link>
        </div>
      </section>

      {how && (
        <div className="flex items-start gap-2 rounded-2xl bg-primary-light px-3 py-2.5 text-sm text-primary-pressed">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            <strong>Como obtemos os horários?</strong> Os horários são os programados no GTFS oficial da SPTrans. Posição dos ônibus e previsão de chegada vêm ao vivo do Olho Vivo.
          </p>
          <button type="button" onClick={() => setHow(false)} aria-label="Fechar aviso" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* horários */}
      <section aria-labelledby="ln-sched" className="rounded-3xl bg-white p-4 shadow-soft">
        <h2 id="ln-sched" className="flex items-center justify-between gap-2 text-lg font-extrabold text-ink">
          Horários
          <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", running ? "bg-risk-low/10 text-[#0f7a37]" : "bg-canvas text-muted")}>
            <span className={cn("h-2 w-2 rounded-full", running ? "bg-risk-low" : "bg-risk-unknown")} aria-hidden />
            {running ? "Operando agora" : "Fora do horário"}
          </span>
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Primeira", dir.first ?? "—"],
            ["Última", dir.last ?? "—"],
            ["Intervalo agora", running && every ? `~${every} min` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-canvas px-2 py-2.5">
              <dd className="text-lg font-extrabold leading-tight text-ink">{v}</dd>
              <dt className="text-[11px] text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
          <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-semibold">Próximas partidas de {stops[0]?.name}:</span>
          <span className="font-extrabold">{next.length ? next.join(", ") : "sem partidas hoje"}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Horário agendado (aproximado) · {daysLabel(dir.days)}
          {line.fare ? ` · tarifa ${brl(line.fare)}` : ""}
          {dir.trip ? ` · viagem de ~${dir.trip} min` : ""}
        </p>
        <button type="button" onClick={() => setGrid((g) => !g)} aria-expanded={grid} aria-controls="ln-grid" className="mt-1 inline-flex h-11 items-center gap-1 text-sm font-bold text-primary-pressed">
          Grade horária completa <ChevronDown className={cn("h-4 w-4 transition-transform", grid && "rotate-180")} aria-hidden />
        </button>
        <div id="ln-grid" hidden={!grid}>
          <table className="w-full text-sm">
            <caption className="sr-only">Intervalo programado entre partidas, por hora</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-1.5 font-semibold">
                  Hora
                </th>
                <th scope="col" className="py-1.5 font-semibold">
                  Intervalo
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold">
                  Partidas na hora
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...dir.freq]
                .sort((a, b) => a[0] - b[0])
                .map(([h, every]) => (
                  <tr key={h}>
                    <th scope="row" className="py-2 text-left font-bold text-ink">
                      {pad(h)}:00
                    </th>
                    <td className="py-2 text-ink">a cada {every} min</td>
                    <td className="py-2 text-right text-muted">{Math.max(1, Math.round(60 / every))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* paradas */}
      <section aria-labelledby="ln-stops" className="rounded-3xl bg-white p-4 shadow-soft">
        <h2 id="ln-stops" className="flex items-center justify-between gap-2 text-lg font-extrabold text-ink">
          {isBus ? "Paradas" : "Estações"}
          <span className="text-sm font-semibold text-muted">{stops.length}</span>
        </h2>
        <p className="text-xs text-muted">{isBus ? "Toque em uma parada para ver os próximos ônibus." : "Toque em uma estação para ver as linhas que passam nela."}</p>
        <ol className="relative mt-3">
          <span className="absolute bottom-5 left-[9px] top-5 w-1 rounded-full" style={{ background: line.color }} aria-hidden />
          {visible.map((s, i) => {
            const end = i === 0 || (allStops || stops.length <= 9 ? i === stops.length - 1 : false);
            return (
              <li key={`${s.id}-${i}`}>
                <button type="button" onClick={() => setStopId(s.id)} className="relative flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  <span className={cn("relative z-10 shrink-0 rounded-full border-[3px] bg-white", end ? "h-[22px] w-[22px]" : "ml-[3px] h-4 w-4")} style={{ borderColor: line.color }} aria-hidden />
                  <span className={cn("min-w-0 flex-1 break-words text-[15px] leading-snug text-ink", end ? "font-extrabold" : "font-medium")}>{s.name}</span>
                  {i === 0 && running && next[0] && <span className="shrink-0 rounded-lg bg-primary-light px-2 py-1 text-xs font-extrabold text-primary-pressed">{next[0]}</span>}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
        {stops.length > 9 && (
          <button type="button" onClick={() => setAllStops((v) => !v)} aria-expanded={allStops} className="tap mt-2 h-12 w-full rounded-2xl bg-canvas text-sm font-bold text-ink">
            {allStops ? "Mostrar menos" : `Mostrar todas as ${stops.length} ${isBus ? "paradas" : "estações"}`}
          </button>
        )}
      </section>

      {isBus && live && status.data?.state === "LIVE" && (
        <p className="flex items-center gap-2 px-1 text-xs text-muted">
          <Accessibility className="h-4 w-4" aria-hidden /> {status.data.accessible} de {status.data.running} ônibus em circulação neste sentido têm acessibilidade.
        </p>
      )}

      <StopSheet stopId={stopId} onClose={() => setStopId(null)} />
    </div>
  );
}
