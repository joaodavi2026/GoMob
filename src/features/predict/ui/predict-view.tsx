"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, DemoBadge, ErrorState, Skeleton } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api";
import { RiskPanel } from "@/features/intelligence/ui/risk-panel";
import type { TransitLine } from "@/types/transit";
import type { Prediction } from "../engine";
import { WEEKDAYS } from "../engine";

type LinesData = { lines: (TransitLine & { active: boolean })[] };
type PredictData = { prediction: Prediction; line: { id: string; displayCode: string; name: string; direction: number } };
type Params = { lineId: string; mode: "date" | "weekday"; date: string; weekday: string; time: string };

const field = "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PredictView() {
  const [lineId, setLineId] = useState("");
  const [mode, setMode] = useState<"date" | "weekday">("date");
  const [date, setDate] = useState(todayLocal);
  const [weekday, setWeekday] = useState("1");
  const [time, setTime] = useState("08:00");
  const [submitted, setSubmitted] = useState<Params | null>(null);

  const lines = useQuery({ queryKey: ["lines", "all"], queryFn: () => apiFetch<LinesData>("/api/lines") });
  const selected = lines.data?.lines.find((l) => l.id === lineId);

  const result = useQuery({
    queryKey: ["predict", submitted],
    enabled: !!submitted,
    queryFn: () => {
      const s = submitted!;
      const qs = new URLSearchParams({ lineId: s.lineId, time: s.time });
      if (s.mode === "date") qs.set("date", s.date);
      else qs.set("weekday", s.weekday);
      return apiFetch<PredictData>(`/api/predict?${qs.toString()}`);
    },
    staleTime: 60_000,
  });

  const canSubmit = !!lineId && !!time && (mode === "weekday" || !!date);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Planeje antes. Viaje melhor.</h1>
        <p className="mt-2 text-muted">Confira o risco estimado de lotação antes da sua próxima viagem de ônibus.</p>
      </header>

      <Card className="p-4 sm:p-6">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) setSubmitted({ lineId, mode, date, weekday, time });
          }}
        >
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Linha de ônibus</span>
            <select className={field} value={lineId} onChange={(e) => setLineId(e.target.value)} disabled={lines.isPending} required>
              <option value="">{lines.isPending ? "Carregando linhas..." : "Escolha uma linha"}</option>
              {lines.data?.lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayCode} - {l.name}
                </option>
              ))}
            </select>
            {lines.isError && <span className="mt-1 block text-xs text-risk-high">Não foi possível carregar as linhas.</span>}
            {selected && <span className="mt-1 block text-xs text-muted">Sentido {selected.direction}</span>}
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden /> {mode === "date" ? "Data" : "Dia da semana"}</span>
              <button type="button" className="text-xs font-medium text-primary-pressed underline" onClick={() => setMode(mode === "date" ? "weekday" : "date")}>
                Usar {mode === "date" ? "dia da semana" : "uma data"}
              </button>
            </div>
            {mode === "date" ? (
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Data" />
            ) : (
              <select className={field} value={weekday} onChange={(e) => setWeekday(e.target.value)} aria-label="Dia da semana">
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            )}
          </div>

          <label>
            <span className="mb-1.5 flex items-center gap-1 text-sm font-medium"><Clock className="h-4 w-4" aria-hidden /> Horário</span>
            <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit} loading={result.isFetching}>
              Prever risco
            </Button>
          </div>
        </form>
      </Card>

      {submitted && result.isFetching && !result.data && <Skeleton className="h-48 w-full" />}
      {result.isError && <ErrorState message={(result.error as Error).message} onRetry={() => result.refetch()} />}
      {result.data && <PredictionResult data={result.data} />}
    </div>
  );
}

function PredictionResult({ data }: { data: PredictData }) {
  const { prediction: p, line } = data;
  return (
    <Card className="space-y-4 p-4 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{line.displayCode}</Badge>
        <span className="text-sm text-muted">{line.name}</span>
      </div>
      <p className="text-sm">
        {p.requested.date ? `${p.requested.weekdayLabel}, ${p.requested.date}` : p.requested.weekdayLabel} às <strong>{p.requested.time}</strong>
      </p>

      {p.isDemo && (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary-light p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-pressed" aria-hidden />
          <p><strong>Cenário de demonstração.</strong> Este resultado ilustrativo não é uma previsão validada e não deriva de histórico real. <DemoBadge /></p>
        </div>
      )}

      <RiskPanel risk={p.risk} />

      <section>
        <h2 className="text-sm font-semibold">Qualidade dos dados</h2>
        <p className="mt-1 text-sm"><Badge tone={p.dataQuality.level === "HIGH" || p.dataQuality.level === "MEDIUM" ? "low" : "unknown"}>{p.dataQuality.label}</Badge></p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {p.dataQuality.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Fonte histórica</h2>
        <p className="mt-1 text-sm text-muted">{p.historicalSource.description}</p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Limitações</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
          {p.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </Card>
  );
}
