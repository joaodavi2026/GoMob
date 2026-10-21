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
        <h1 className="text-3xl font-bold tracking-tight">Plan ahead. Travel smarter.</h1>
        <p className="mt-2 text-muted">Explore estimated crowding risks before your next bus journey.</p>
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
            <span className="mb-1.5 block text-sm font-medium">Bus line</span>
            <select className={field} value={lineId} onChange={(e) => setLineId(e.target.value)} disabled={lines.isPending} required>
              <option value="">{lines.isPending ? "Loading lines..." : "Select a line"}</option>
              {lines.data?.lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayCode} - {l.name}
                </option>
              ))}
            </select>
            {lines.isError && <span className="mt-1 block text-xs text-risk-high">Lines could not be loaded.</span>}
            {selected && <span className="mt-1 block text-xs text-muted">Direction {selected.direction}</span>}
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden /> {mode === "date" ? "Date" : "Day of week"}</span>
              <button type="button" className="text-xs font-medium text-primary-pressed underline" onClick={() => setMode(mode === "date" ? "weekday" : "date")}>
                Use {mode === "date" ? "day of week" : "a date"}
              </button>
            </div>
            {mode === "date" ? (
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Date" />
            ) : (
              <select className={field} value={weekday} onChange={(e) => setWeekday(e.target.value)} aria-label="Day of week">
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            )}
          </div>

          <label>
            <span className="mb-1.5 flex items-center gap-1 text-sm font-medium"><Clock className="h-4 w-4" aria-hidden /> Time</span>
            <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit} loading={result.isFetching}>
              Predict risk
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
        {p.requested.date ? `${p.requested.weekdayLabel}, ${p.requested.date}` : p.requested.weekdayLabel} at <strong>{p.requested.time}</strong>
      </p>

      {p.isDemo && (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary-light p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-pressed" aria-hidden />
          <p><strong>Demonstration scenario.</strong> This illustrative result is not a validated forecast and is not derived from real history. <DemoBadge /></p>
        </div>
      )}

      <RiskPanel risk={p.risk} />

      <section>
        <h2 className="text-sm font-semibold">Data quality</h2>
        <p className="mt-1 text-sm"><Badge tone={p.dataQuality.level === "HIGH" || p.dataQuality.level === "MEDIUM" ? "low" : "unknown"}>{p.dataQuality.label}</Badge></p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {p.dataQuality.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Historical source</h2>
        <p className="mt-1 text-sm text-muted">{p.historicalSource.description}</p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Limitations</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
          {p.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </Card>
  );
}
