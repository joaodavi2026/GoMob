"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BusFront, ChevronLeft, ChevronRight, ChevronUp, Clock, Flag, Footprints, LocateFixed, Lock, MoonStar, Pause, Play, Users, Volume2, VolumeX, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { usePlan } from "@/features/premium/use-plan";
import type { BusRouteOption, GeoPoint } from "@/types/transit";
import { askNotifyPermission, keepScreenOn, notifyState, registerWorker, systemNotify, type NotifyState } from "./background";
import {
  advance,
  buildTrip,
  fmtDist,
  instruction,
  meters,
  nearestBusEta,
  remainingMinutes,
  simulationPath,
  startProgress,
  type LL,
  type Progress,
  type TripEvent,
} from "./logic";

const TripMap = dynamic(() => import("./trip-map").then((m) => m.TripMap), { ssr: false });

type LineStatus = { state: "LIVE" | "UNAVAILABLE"; vehicles: [number, number, string, number, number][] };
type Source = "gps" | "sim" | "none";
type FamilyInfo = { me: { isOwner: boolean }; members: unknown[] };
const SHEET = 300;

/** Reduz uma lista de pontos para no máximo `max`, mantendo o primeiro e o último. */
function thin<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.round((i * (pts.length - 1)) / (max - 1))]);
  return out;
}

/**
 * Modo "em trajeto": mapa em tela cheia guiando a pessoa (como um app de navegação).
 * Usa o GPS do celular; sem GPS, dá para avançar manualmente ou simular a viagem (apresentação).
 */
export function TripMode({ route, origin, destination, onClose }: { route: BusRouteOption; origin: GeoPoint; destination: GeoPoint; onClose: () => void }) {
  const trip = useMemo(() => buildTrip(route, origin, destination), [route, origin, destination]);
  const { prefs, speak, stop, announce, notify } = useA11y();
  const [progress, setProgress] = useState<Progress>(startProgress);
  const [pos, setPos] = useState<LL | null>(null);
  const [source, setSource] = useState<Source>("none");
  const [gpsMsg, setGpsMsg] = useState<string | null>("Procurando sua localização…");
  const [follow, setFollow] = useState(true);
  const [voiceOn, setVoiceOn] = useState(prefs.voice);
  const [simulating, setSimulating] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const qc = useQueryClient();
  const { premium } = usePlan();
  const [startedAt] = useState(() => Date.now());
  // Premium: trajeto em segundo plano (tela ligada + avisos por notificação)
  const [bgOn, setBgOn] = useState(true);
  const [notif, setNotif] = useState<NotifyState>("default");
  const [bgHint, setBgHint] = useState(false);
  const bgActive = premium && bgOn;
  // Família: compartilhar o trajeto ao vivo (ligado por padrão quando há alguém na família)
  const family = useQuery({ queryKey: ["family"], staleTime: 30_000, retry: 0, queryFn: () => apiFetch<FamilyInfo>("/api/family") });
  const hasFamily = (family.data?.members.length ?? 0) > 0;
  const [shareChoice, setShareChoice] = useState<boolean | null>(null);
  const [shareHint, setShareHint] = useState(false);
  const sharing = hasFamily && (shareChoice ?? true);
  const recorded = useRef(false);
  const modeRef = useRef<"gps" | "sim" | "manual">("manual");
  const bgRef = useRef(false);
  // relógio para o horário de chegada (atualiza a cada 30 s)
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // refs para os callbacks (GPS e simulação) sempre verem o estado atual
  const progressRef = useRef(progress);
  const voiceRef = useRef(voiceOn);
  const simRef = useRef(false);
  useEffect(() => {
    progressRef.current = progress;
    voiceRef.current = voiceOn;
    simRef.current = simulating;
    bgRef.current = bgActive;
  });

  /** Guarda o trajeto na aba Atividade (uma vez só). */
  const record = useCallback(
    (status: "COMPLETED" | "CANCELED") => {
      if (!trip || recorded.current) return;
      recorded.current = true;
      const pts = [trip.origin, ...trip.legs.flatMap((l) => l.stops), trip.destination];
      let distanceM = 0;
      for (let i = 1; i < pts.length; i++) distanceM += meters(pts[i - 1], pts[i]);
      const now = Date.now();
      apiFetch("/api/activity", {
        method: "POST",
        body: JSON.stringify({
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date(now).toISOString(),
          elapsedSec: Math.round((now - startedAt) / 1000),
          plannedMin: route.durationMinutes,
          origin: trip.origin.name.slice(0, 120),
          destination: trip.destination.name.slice(0, 120),
          from: [trip.origin.lat, trip.origin.lon],
          to: [trip.destination.lat, trip.destination.lon],
          lines: trip.legs.map((l) => l.code).slice(0, 4),
          transfers: Math.max(0, trip.legs.length - 1),
          distanceM: Math.round(distanceM),
          status,
          mode: modeRef.current,
          path: thin(pts, 100).map((p) => [p.lon, p.lat]),
        }),
      })
        .then(() => qc.invalidateQueries({ queryKey: ["activity"] }))
        .catch(() => {
          recorded.current = false;
        });
    },
    [trip, route, startedAt, qc],
  );

  const say = useCallback(
    (text: string) => {
      announce(text);
      if (voiceRef.current) speak(text);
    },
    [announce, speak],
  );

  /** Nova posição (GPS ou simulada): avança as fases e dispara os avisos. */
  const onPosition = useCallback(
    (p: LL) => {
      if (!trip) return;
      setPos(p);
      const { progress: np, events } = advance(trip, progressRef.current, p);
      progressRef.current = np;
      setProgress(np);
      const has = (e: TripEvent) => events.includes(e);
      // com o app minimizado (Premium), o aviso também chega como notificação do sistema
      const push = (title: string, body: string) => {
        if (bgRef.current && document.hidden) void systemNotify(title, body);
      };
      if (has("arrived")) {
        notify(`Você chegou: ${trip.destination.name}.`);
        push("Você chegou", trip.destination.name);
        record("COMPLETED");
      } else if (has("next_is_yours")) {
        const leg = trip.phases[np.phase];
        const stopName = leg && leg.kind === "ride" ? trip.legs[leg.leg].stops.at(-1)!.name : "";
        notify(`Seu ponto é o próximo: ${stopName}. Prepare-se para descer.`);
        push("Seu ponto é o próximo", `${stopName}. Prepare-se para descer.`);
      } else if (has("phase_changed")) {
        const ins = instruction(trip, np, p);
        say(`${ins.title}. ${ins.detail}.`);
        push(ins.title, ins.detail);
      }
    },
    [trip, notify, say, record],
  );

  // GPS real (ignorado enquanto a simulação está rodando)
  useEffect(() => {
    if (!trip) return;
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setGpsMsg("Este aparelho não informa a localização. Use Próximo ou Simular."));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (g) => {
        if (simRef.current) return;
        if (modeRef.current === "manual") modeRef.current = "gps";
        setSource("gps");
        setGpsMsg(null);
        onPosition({ lat: g.coords.latitude, lon: g.coords.longitude });
      },
      (err) =>
        setGpsMsg(
          err.code === err.PERMISSION_DENIED
            ? "Localização não permitida. Use Próximo para avançar ou Simular trajeto."
            : "Não foi possível obter sua localização agora. Use Próximo ou Simular.",
        ),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [trip, onPosition]);

  // simulação para demonstração
  useEffect(() => {
    if (!trip || !simulating) return;
    modeRef.current = "sim";
    const path = simulationPath(trip);
    let i = 0;
    const t = setInterval(() => {
      if (i >= path.length) {
        clearInterval(t);
        setSimulating(false);
        return;
      }
      onPosition(path[i]);
      i++;
    }, 250);
    return () => clearInterval(t);
  }, [trip, simulating, onPosition]);

  // Premium: tela ligada enquanto o trajeto está aberto (o navegador solta o bloqueio ao sair; pede de novo ao voltar)
  useEffect(() => {
    if (!bgActive) return;
    registerWorker();
    queueMicrotask(() => setNotif(notifyState()));
    let lock: { release: () => Promise<void> } | null = null;
    let dead = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      const l = await keepScreenOn();
      if (dead) return void l?.release().catch(() => {});
      lock = l;
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [bgActive]);

  // Família: retrato atual do trajeto, enviado a cada 3 s enquanto o compartilhamento está ligado
  const snapshot = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!trip) return;
    const ins = instruction(trip, progress, pos);
    const pts = [trip.origin, ...trip.legs.flatMap((l) => l.stops), trip.destination];
    snapshot.current = {
      origin: trip.origin.name.slice(0, 120),
      destination: trip.destination.name.slice(0, 120),
      lines: trip.legs.map((l) => l.code).slice(0, 4),
      title: ins.title.slice(0, 160),
      detail: ins.detail.slice(0, 200),
      minutes: remainingMinutes(trip, progress, pos),
      arrived: trip.phases[progress.phase]?.kind === "arrived",
      pos: pos ? [pos.lat, pos.lon] : null,
      dest: [trip.destination.lat, trip.destination.lon],
      path: thin(pts, 150).map((p) => [p.lon, p.lat]),
    };
  });
  useEffect(() => {
    if (!trip || !sharing) return;
    const send = () => {
      if (!snapshot.current) return;
      void fetch("/api/family/share", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot.current), keepalive: true }).catch(() => {});
    };
    const first = setTimeout(send, 300);
    const t = setInterval(send, 3000);
    // fechou a aba ou saiu da página sem tocar em Encerrar: avisa o servidor que o trajeto acabou
    const onLeave = () => void navigator.sendBeacon?.("/api/family/share");
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      window.removeEventListener("pagehide", onLeave);
      void fetch("/api/family/share", { method: "DELETE", keepalive: true }).catch(() => {});
    };
  }, [trip, sharing]);

  // ao abrir: foco na instrução e leitura da primeira etapa
  useEffect(() => {
    titleRef.current?.focus();
    if (trip) {
      const ins = instruction(trip, startProgress(), null);
      say(`Trajeto iniciado. ${ins.title}.`);
    }
    return () => stop();
    // somente na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // linha atual (ou a próxima) para mostrar os ônibus ao vivo
  const phase = trip?.phases[progress.phase];
  const legIndex = phase && (phase.kind === "wait" || phase.kind === "ride") ? phase.leg : phase?.kind === "walk" && !phase.final ? 0 : null;
  const leg = trip && legIndex !== null ? trip.legs[legIndex] : null;
  const status = useQuery({
    queryKey: ["trip-line", leg?.code, leg?.direction],
    enabled: !!leg,
    refetchInterval: 15_000,
    queryFn: () => apiFetch<LineStatus>(`/api/network/line-status?code=${encodeURIComponent(leg!.code)}&dir=${leg!.direction}`),
  });
  const buses = useMemo<LL[]>(() => (status.data?.vehicles ?? []).map(([lat, lon]) => ({ lat, lon })), [status.data]);
  const eta = leg ? nearestBusEta(leg.stops[0], buses) : null;

  if (!trip) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-canvas p-6 text-center" role="dialog" aria-modal="true" aria-label="Modo em trajeto">
        <p className="max-w-sm text-base font-semibold text-ink">O modo em trajeto precisa das paradas da rota, que esta opção não tem.</p>
        <button type="button" onClick={onClose} className="tap h-12 rounded-2xl bg-night px-6 font-semibold text-white">
          Voltar
        </button>
      </div>
    );
  }

  const ins = instruction(trip, progress, pos);
  const mins = remainingMinutes(trip, progress, pos);
  const arrival = new Date(clock + mins * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const kind = phase?.kind ?? "arrived";
  const Icon = kind === "walk" ? Footprints : kind === "wait" ? Clock : kind === "ride" ? BusFront : Flag;

  const go = (delta: number) => {
    const n = Math.max(0, Math.min(trip.phases.length - 1, progress.phase + delta));
    const np: Progress = { phase: n, lastStop: 0, warnedNext: false };
    progressRef.current = np;
    setProgress(np);
    const t = instruction(trip, np, pos);
    say(`${t.title}. ${t.detail}.`);
    if (trip.phases[n].kind === "arrived") record("COMPLETED");
  };

  /** Encerrar: um trajeto interrompido no meio também fica na Atividade (como cancelado). */
  const finish = () => {
    if (!recorded.current && (progress.phase > 0 || clock - startedAt >= 30_000)) record("CANCELED");
    onClose();
  };

  const toggleShare = () => {
    if (!hasFamily) return setShareHint((v) => !v);
    const next = !sharing;
    setShareChoice(next);
    announce(next ? "Compartilhando seu trajeto com a família." : "Você parou de compartilhar o trajeto.");
  };

  const toggleBackground = async () => {
    if (!premium) return setBgHint((v) => !v);
    if (bgOn && notif === "default") {
      const state = await askNotifyPermission();
      setNotif(state);
      return announce(state === "granted" ? "Avisos por notificação ativados." : "As notificações não foram permitidas. A tela continua ligada durante o trajeto.");
    }
    setBgOn((v) => !v);
    announce(bgOn ? "Trajeto em segundo plano desligado." : "Trajeto em segundo plano ligado.");
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-canvas" role="dialog" aria-modal="true" aria-labelledby="trip-title" data-no-ads>
      <TripMap trip={trip} user={pos} buses={buses} follow={follow} onUserPan={() => setFollow(false)} bottomPad={SHEET} />

      {/* instrução atual */}
      <div className="absolute inset-x-0 top-0 z-10 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className={cn("flex items-start gap-3 rounded-3xl p-4 text-white shadow-float", kind === "arrived" ? "bg-risk-low" : "bg-night")}>
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", kind === "arrived" ? "bg-white/20" : "bg-primary")}>
            <Icon className="h-7 w-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1" aria-live="polite">
            <h2 id="trip-title" ref={titleRef} tabIndex={-1} className="break-words text-xl font-extrabold leading-tight outline-none">
              {ins.title}
            </h2>
            <p className="mt-1 break-words text-sm text-white/80">{ins.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (voiceOn) stop();
              setVoiceOn((v) => !v);
            }}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Desligar voz do trajeto" : "Ligar voz do trajeto"}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10"
          >
            {voiceOn ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        {leg && (kind === "wait" || (phase?.kind === "walk" && !phase.final)) && (
          <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink shadow-soft" role="status">
            <BusFront className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {status.isPending
              ? "Procurando ônibus da linha…"
              : status.data?.state !== "LIVE"
                ? "Posição dos ônibus indisponível agora"
                : eta
                  ? `Ônibus ${leg.code} mais próximo: ~${eta.minutes} min (${fmtDist(eta.meters)}) · estimativa`
                  : `Nenhum ônibus ${leg.code} circulando agora neste sentido`}
          </p>
        )}
      </div>

      {/* recentralizar */}
      {!follow && pos && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="tap absolute left-3 z-10 flex h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-float"
          style={{ bottom: SHEET + 16 }}
        >
          <LocateFixed className="h-5 w-5 text-primary" aria-hidden /> Seguir minha posição
        </button>
      )}

      {/* painel inferior */}
      <section aria-label="Resumo e controles do trajeto" className="absolute inset-x-0 bottom-0 z-20 flex max-h-[62%] flex-col rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgb(18_21_27/0.18)]">
        <span className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="min-w-0">
            <p className="text-2xl font-extrabold leading-tight text-ink">{kind === "arrived" ? "Chegou" : `${mins} min`}</p>
            {kind !== "arrived" && <p className="text-sm font-semibold text-muted">Chegada por volta de {arrival}</p>}
            <p className="mt-0.5 text-xs text-muted">
              {source === "gps" ? "Usando o GPS do seu celular" : simulating ? "Simulação do trajeto em andamento" : gpsMsg ?? "Sem localização"}
            </p>
          </div>
          <button type="button" onClick={finish} className="tap flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-risk-high px-4 text-sm font-bold text-white">
            <X className="h-5 w-5" aria-hidden /> Encerrar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pt-3">
          <button
            type="button"
            onClick={toggleShare}
            aria-pressed={sharing}
            className={cn("tap flex h-12 items-center gap-2 rounded-2xl px-3 text-left text-xs font-bold leading-tight", sharing ? "bg-primary-light text-primary-pressed" : "bg-canvas text-ink")}
          >
            <Users className="h-5 w-5 shrink-0" aria-hidden />
            {sharing ? "Família acompanhando" : "Compartilhar com a família"}
          </button>
          <button
            type="button"
            onClick={toggleBackground}
            aria-pressed={bgActive}
            className={cn("tap flex h-12 items-center gap-2 rounded-2xl px-3 text-left text-xs font-bold leading-tight", bgActive ? "bg-primary-light text-primary-pressed" : "bg-canvas text-ink")}
          >
            {premium ? <MoonStar className="h-5 w-5 shrink-0" aria-hidden /> : <Lock className="h-5 w-5 shrink-0" aria-hidden />}
            {!premium ? "Segundo plano · Premium" : !bgOn ? "Segundo plano desligado" : notif === "default" ? "Ativar notificações" : notif === "granted" ? "Segundo plano ligado" : "Tela ligada · sem notificações"}
          </button>
        </div>
        {(bgHint || shareHint) && (
          <p role="status" className="mx-5 mt-2 rounded-2xl bg-night px-3 py-2 text-xs text-white">
            {bgHint ? "No Premium a tela não apaga e os avisos chegam por notificação com o app minimizado. " : "Convide alguém na aba Família para acompanhar seu trajeto ao vivo. "}
            <Link href={bgHint ? "/premium" : "/family"} className="font-bold text-primary underline underline-offset-2">
              {bgHint ? "Conhecer o Premium" : "Abrir Família"}
            </Link>
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 px-5 pt-2">
          <button type="button" onClick={() => go(-1)} disabled={progress.phase === 0} className="tap flex h-12 items-center justify-center gap-1 rounded-2xl bg-canvas text-sm font-semibold text-ink disabled:opacity-40">
            <ChevronLeft className="h-5 w-5" aria-hidden /> Anterior
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={progress.phase >= trip.phases.length - 1}
            className="tap flex h-12 items-center justify-center gap-1 rounded-2xl bg-canvas text-sm font-semibold text-ink disabled:opacity-40"
          >
            Próximo <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!simulating) {
                const np = startProgress();
                progressRef.current = np;
                setProgress(np);
                setFollow(true);
              }
              setSimulating((s) => !s);
            }}
            aria-pressed={simulating}
            className="tap flex h-12 items-center justify-center gap-1 rounded-2xl bg-night text-sm font-semibold text-white"
          >
            {simulating ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {simulating ? "Parar" : "Simular"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowSteps((s) => !s)}
          aria-expanded={showSteps}
          aria-controls="trip-steps"
          className={cn("mx-5 mt-2 flex h-11 items-center justify-center gap-1 text-sm font-semibold text-primary-pressed", !showSteps && "mb-[max(8px,env(safe-area-inset-bottom))]")}
        >
          {showSteps ? "Esconder etapas" : `Ver etapas (${trip.phases.length})`}
          <ChevronUp className={cn("h-4 w-4 transition-transform", !showSteps && "rotate-180")} aria-hidden />
        </button>

        <ol
          id="trip-steps"
          hidden={!showSteps}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]"
          aria-label="Etapas do trajeto"
        >
          {trip.phases.map((ph, i) => {
            const t = instruction(trip, { phase: i, lastStop: 0, warnedNext: false }, null).title;
            const done = i < progress.phase;
            const now = i === progress.phase;
            return (
              <li
                key={i}
                aria-current={now ? "step" : undefined}
                className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 text-sm", now ? "bg-primary-light font-bold text-ink" : done ? "text-muted line-through" : "text-ink")}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", now ? "bg-primary text-white" : "bg-canvas text-muted")} aria-hidden>
                  {i + 1}
                </span>
                <span className="break-words">
                  {done && <span className="sr-only">Concluída: </span>}
                  {ph.kind === "ride" ? `Siga na linha ${trip.legs[ph.leg].code} até ${trip.legs[ph.leg].stops.at(-1)!.name}` : t}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
