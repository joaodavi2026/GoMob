"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accessibility, BellRing, Bookmark, BookmarkCheck, Bus, Footprints, Info, Landmark, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { RiskPanel } from "@/features/intelligence/ui/risk-panel";
import { RiskBadge } from "@/components/ui/risk-badge";
import { TransitMap } from "@/components/maps";
import { AlertsList } from "@/features/alerts/ui/alerts-list";
import { SpeakButton } from "@/features/a11y/a11y";
import { apiFetch } from "@/lib/api";
import type { GeoPoint, RouteStep } from "@/types/transit";
import { busLineCodes } from "../risk";
import type { RouteResult } from "../types";
import { ReportProblem } from "./report-problem";

type BusStep = Extract<RouteStep, { kind: "BUS" }>;
type LineStatus = { state: "LIVE" | "UNAVAILABLE"; running: number | null; accessible: number | null };

/** Uma ação por etapa, em frases curtas (ordem em que a pessoa executa). */
function actions(route: RouteResult, destination: string) {
  const out: { icon: "walk" | "bus" | "stop"; title: string; detail: string }[] = [];
  route.steps.forEach((s, i) => {
    if (s.kind === "WALK") {
      const last = i === route.steps.length - 1;
      out.push(
        last
          ? { icon: "walk", title: `Caminhe até ${destination}`, detail: `${s.minutes} min a pé a partir do ponto ${s.from}` }
          : { icon: "walk", title: `Vá a pé até o ponto ${s.to}`, detail: `${s.minutes} min de caminhada` },
      );
      return;
    }
    const prev = route.steps[i - 1];
    out.push({
      icon: "bus",
      title: `Pegue a linha ${s.lineCode}, ${s.lineName}`,
      detail: prev?.kind === "BUS" ? `No mesmo ponto: ${s.boardStop}` : `No ponto ${s.boardStop}`,
    });
    out.push({ icon: "stop", title: `Desça no ponto ${s.alightStop}`, detail: `Cerca de ${s.minutes} min de viagem` });
  });
  return out;
}

function useLineStatus(step: BusStep) {
  return useQuery({
    queryKey: ["line-status", step.lineCode, step.direction ?? 0],
    queryFn: () => apiFetch<LineStatus>(`/api/network/line-status?code=${encodeURIComponent(step.lineCode)}&dir=${step.direction ?? 0}`),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

/** Situação da linha escrita por extenso (nunca só cor) e acessibilidade do veículo. */
function useLineFacts(step: BusStep, route: RouteResult) {
  const st = useLineStatus(step);
  const risk = route.lineRisks[step.lineCode];
  const live = st.data?.state === "LIVE";
  const running = st.data?.running ?? 0;
  const accessible = st.data?.accessible ?? 0;

  const situation = st.isPending
    ? "Consultando a situação da linha…"
    : !live
      ? "Situação ao vivo indisponível. Use o horário programado."
      : running === 0
        ? "Nenhum ônibus desta linha circulando agora neste sentido."
        : `Em operação: ${running} ${running === 1 ? "ônibus circulando" : "ônibus circulando"} agora neste sentido.`;
  const vehicle = st.isPending
    ? "Consultando…"
    : !live
      ? "Acessibilidade dos veículos não informada agora."
      : running === 0
        ? "Sem ônibus circulando para consultar."
        : accessible === running
          ? `Todos os ${running} ônibus circulando estão cadastrados como acessíveis.`
          : `${accessible} de ${running} ônibus circulando estão cadastrados como acessíveis.`;

  return { situation, vehicle, risk, live, running };
}

function LineBlock({ step, route }: { step: BusStep; route: RouteResult }) {
  const f = useLineFacts(step, route);
  return (
    <li className="rounded-2xl border border-border p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
        <span className="flex items-center gap-1 rounded-lg bg-night px-2 py-0.5 text-xs text-white">
          <Bus className="h-3.5 w-3.5 text-primary" aria-hidden /> {step.lineCode}
        </span>
        <span className="break-words">{step.lineName}</span>
      </p>
      <dl className="mt-2 space-y-2 text-sm">
        <div>
          <dt className="font-semibold text-ink">Situação agora</dt>
          <dd className="text-muted" aria-live="polite">{f.situation}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 font-semibold text-ink">
            <Accessibility className="h-4 w-4 text-primary" aria-hidden /> Veículo
          </dt>
          <dd className="text-muted">{f.vehicle}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Lotação estimada</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-muted">
            {f.risk ? <RiskBadge level={f.risk.level} /> : <span>Sem estimativa para esta linha agora.</span>}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export function RouteDetails({
  route,
  origin,
  destination,
  onClose,
  onSave,
  saving,
  saved,
}: {
  route: RouteResult;
  origin: GeoPoint;
  destination: GeoPoint;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // ao abrir, o foco vai para o título: leitor de tela e teclado começam no lugar certo
  useEffect(() => {
    heading.current?.focus();
  }, [route.id]);

  const buses = route.steps.filter((s): s is BusStep => s.kind === "BUS");
  const firstLineId = buses.find((b) => b.lineId)?.lineId;
  const from = origin.label ?? "a origem";
  const to = destination.label ?? "o destino";
  const steps = actions(route, to);
  const summary = `${from} até ${to}. ${route.durationMinutes ?? "Duração desconhecida"} minutos no total, ${route.walkMinutes} de caminhada, ${
    route.transfers === 0 ? "sem baldeação" : route.transfers === 1 ? "com 1 baldeação" : `com ${route.transfers} baldeações`
  }.`;
  const stopNames = [...new Set(buses.flatMap((b) => [b.boardStop, b.alightStop]))];
  const terminals = stopNames.filter((n) => /^term(\.|inal)/i.test(n));
  const highRisk = buses.filter((b) => route.lineRisks[b.lineCode]?.level === "HIGH");
  const spoken = `${summary} ${steps.map((s, i) => `Passo ${i + 1}: ${s.title}. ${s.detail}.`).join(" ")}`;

  return (
    <Card className="overflow-hidden">
      <section aria-labelledby="trip-h" className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="trip-h" ref={heading} tabIndex={-1} className="text-xl font-bold tracking-tight outline-none">
              Detalhes do trajeto
            </h2>
            <p className="mt-1 break-words text-sm text-muted">{summary}</p>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose} aria-label="Fechar detalhes do trajeto" className="shrink-0">
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="space-y-2">
          <Button onClick={onSave} loading={saving} disabled={saved} size="lg" className="w-full" aria-describedby="save-status">
            {saved ? <BookmarkCheck className="h-5 w-5" aria-hidden /> : <Bookmark className="h-5 w-5" aria-hidden />}
            {saved ? "Trajeto salvo" : "Salvar trajeto"}
          </Button>
          <p id="save-status" className="text-center text-sm text-muted">
            {saved ? (
              <>
                Salvo em <Link href="/favorites" className="font-semibold text-primary-pressed underline">Salvos</Link>.
              </>
            ) : (
              "Guarda este trajeto para abrir de novo em um toque."
            )}
          </p>
          <SpeakButton text={spoken} label="Ouvir trajeto" className="w-full justify-center" />
        </div>

        <section aria-labelledby="steps-h">
          <h3 id="steps-h" className="mb-2 text-base font-bold">
            Passo a passo
          </h3>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-canvas p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night text-sm font-bold text-white" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-start gap-1.5 break-words text-[15px] font-semibold text-ink">
                    {s.icon === "walk" ? (
                      <Footprints className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    ) : s.icon === "bus" ? (
                      <Bus className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    )}
                    <span>
                      <span className="sr-only">Passo {i + 1}: </span>
                      {s.title}
                    </span>
                  </p>
                  <p className="mt-0.5 break-words text-sm text-muted">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="lines-h">
          <h3 id="lines-h" className="mb-2 text-base font-bold">
            Linhas, situação e acessibilidade
          </h3>
          <ul className="space-y-2">
            {buses.map((b, i) => (
              <LineBlock key={`${b.lineCode}-${i}`} step={b} route={route} />
            ))}
          </ul>
          <dl className="mt-2 space-y-2 rounded-2xl border border-border p-3 text-sm">
            <div>
              <dt className="flex items-center gap-1 font-semibold text-ink">
                <MapPin className="h-4 w-4 text-primary" aria-hidden /> Pontos
              </dt>
              <dd className="break-words text-muted">{stopNames.join(" · ")}: acessibilidade não informada.</dd>
            </div>
            {terminals.length > 0 && (
              <div>
                <dt className="flex items-center gap-1 font-semibold text-ink">
                  <Landmark className="h-4 w-4 text-primary" aria-hidden /> Terminal
                </dt>
                <dd className="break-words text-muted">{terminals.join(" · ")}: acessibilidade não informada. Confirme com a SPTrans antes de sair.</dd>
              </div>
            )}
            <div>
              <dt className="flex items-center gap-1 font-semibold text-ink">
                <Footprints className="h-4 w-4 text-primary" aria-hidden /> Caminhada
              </dt>
              <dd className="text-muted">Cerca de {route.walkMinutes} min a pé no total.</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="notices-h">
          <h3 id="notices-h" className="mb-2 flex items-center gap-1.5 text-base font-bold">
            <BellRing className="h-4 w-4 text-primary" aria-hidden /> Avisos
          </h3>
          <ul className="space-y-2 text-sm">
            {highRisk.map((b) => (
              <li key={b.lineCode} className="rounded-2xl border border-risk-high/30 bg-risk-high/5 p-3 text-ink">
                <strong>Lotação alta estimada na linha {b.lineCode}.</strong> Se puder, compare com outra opção da lista.
              </li>
            ))}
            {route.source === "GTFS" && (
              <li className="flex gap-2 rounded-2xl bg-canvas p-3 text-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Tempos estimados pelo horário programado da SPTrans. Ainda não é previsão de chegada em tempo real.
              </li>
            )}
            {highRisk.length === 0 && route.source !== "GTFS" && <li className="rounded-2xl bg-canvas p-3 text-muted">Nenhum aviso no momento.</li>}
          </ul>
          {firstLineId && (
            <div className="mt-2">
              <AlertsList lineId={firstLineId} compact limit={2} />
            </div>
          )}
        </section>

        <section aria-labelledby="map-h2">
          <h3 id="map-h2" className="mb-1 text-base font-bold">
            Mapa do trajeto
          </h3>
          <p className="mb-2 text-sm text-muted">O mapa mostra o mesmo trajeto do passo a passo acima. Use os botões + e − para aproximar.</p>
          <div className="h-64 w-full overflow-hidden rounded-2xl sm:h-80">
            <TransitMap vehicles={[]} highlightPath={route.path} extraPoints={[origin, destination]} fitToPath showLocate={false} className="h-full w-full" />
          </div>
        </section>

        {route.risk && (
          <section aria-labelledby="risk-h">
            <h3 id="risk-h" className="mb-1 text-base font-bold">
              Risco estimado de lotação ({busLineCodes(route).join(", ")})
            </h3>
            <RiskPanel risk={route.risk} compact />
          </section>
        )}

        <ReportProblem context={`${from} → ${to} · ${busLineCodes(route).join(", ")}`} />
      </section>
    </Card>
  );
}
