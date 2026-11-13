"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusFront, ChevronDown, Clock, MapPin, RotateCcw, Route, Trash2, Wallet } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { formatPointParam } from "@/features/routes/points";
import type { Activity } from "./store";

export const ACTIVITY_KEY = ["activity"] as const;

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Minutos que contam para o trajeto: tempo real; na simulação (acelerada), a duração prevista da rota. */
export function tripMinutes(a: Pick<Activity, "mode" | "plannedMin" | "elapsedSec">): number {
  if (a.mode === "sim" && a.plannedMin) return Math.round(a.plannedMin);
  return Math.max(1, Math.round(a.elapsedSec / 60));
}
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** Desenho do caminho (sem mapa): linha do trajeto com início e destino. */
function RouteSketch({ path, className }: { path: [number, number][]; className?: string }) {
  const S = 72;
  const P = 12;
  let d = "";
  let a = { x: S / 2, y: S / 2 };
  let b = a;
  if (path.length >= 2) {
    const lats = path.map((p) => p[1]);
    const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
    const xs = path.map((p) => p[0] * k);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...lats), Math.max(...lats)];
    const scale = (S - 2 * P) / Math.max(maxX - minX, maxY - minY, 1e-6);
    const ox = (S - (maxX - minX) * scale) / 2;
    const oy = (S - (maxY - minY) * scale) / 2;
    const pts = path.map((p, i) => ({ x: ox + (xs[i] - minX) * scale, y: S - oy - (p[1] - minY) * scale }));
    d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    a = pts[0];
    b = pts[pts.length - 1];
  }
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={cn("rounded-2xl bg-canvas", className)} aria-hidden>
      <path d={`M0 ${S * 0.3}H${S}M0 ${S * 0.68}H${S}M${S * 0.36} 0V${S}M${S * 0.74} 0V${S}`} stroke="#e1e4ea" strokeWidth="3" />
      {d && <path d={d} fill="none" stroke="#ff6b00" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={a.x} cy={a.y} r="4.5" fill="#fff" stroke="#12151b" strokeWidth="2.5" />
      <circle cx={b.x} cy={b.y} r="5.5" fill="#12151b" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function StatusTag({ a }: { a: Activity }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", a.status === "COMPLETED" ? "bg-risk-low/10 text-[#0f7a37]" : "bg-canvas text-muted")}>{a.status === "COMPLETED" ? "Concluído" : "Cancelado"}</span>
      {a.mode === "sim" && <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary-pressed">Simulação</span>}
    </span>
  );
}

function TripCard({ a, open, onToggle, onDelete }: { a: Activity; open: boolean; onToggle: () => void; onDelete: () => void }) {
  const min = tripMinutes(a);
  // na simulação (acelerada), a chegada mostrada é a prevista: saída + duração da rota
  const arrival = a.mode === "sim" && a.plannedMin ? new Date(Date.parse(a.startedAt) + min * 60_000).toISOString() : a.endedAt;
  const redo = `/routes?o=${encodeURIComponent(formatPointParam({ latitude: a.from[0], longitude: a.from[1], label: a.origin }))}&d=${encodeURIComponent(
    formatPointParam({ latitude: a.to[0], longitude: a.to[1], label: a.destination }),
  )}`;
  const id = `act-${a.id}`;
  return (
    <li className="rounded-3xl bg-white shadow-soft">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="flex w-full items-center gap-3 p-3.5 text-left">
        <RouteSketch path={a.path} className="h-[72px] w-[72px] shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-base font-extrabold leading-snug text-ink">{a.destination}</span>
          <span className="block text-xs text-muted">
            {dayLabel(a.endedAt)} · {hm(a.startedAt)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
            <span>{a.status === "COMPLETED" ? durationLabel(min) : "Não concluído"}</span>
            {a.fare !== null && <span className="text-muted">· {money(a.fare)}</span>}
          </span>
          <span className="mt-1.5 block">
            <StatusTag a={a} />
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div id={id} hidden={!open} className="border-t border-border px-4 pb-4 pt-3">
        <ol className="space-y-2 text-sm">
          <li className="flex items-start gap-2.5">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-[3px] border-ink bg-white" aria-hidden />
            <span className="min-w-0 break-words">
              <span className="sr-only">Saída: </span>
              {a.origin} <span className="text-muted">· {hm(a.startedAt)}</span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 break-words">
              <span className="sr-only">Chegada: </span>
              {a.destination} <span className="text-muted">· {a.status === "COMPLETED" ? `${hm(arrival)}${a.mode === "sim" ? " (previsto)" : ""}` : "não chegou"}</span>
            </span>
          </li>
        </ol>
        {a.lines.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5">
            <BusFront className="h-4 w-4 text-muted" aria-hidden />
            <span className="sr-only">Linhas: </span>
            {a.lines.map((l) => (
              <span key={l} className="rounded-lg bg-night px-2 py-0.5 text-xs font-bold text-white">
                {l}
              </span>
            ))}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {[
            ["Duração", a.status === "COMPLETED" ? durationLabel(min) : "—"],
            ["Previsto", a.plannedMin ? durationLabel(Math.round(a.plannedMin)) : "—"],
            ["Distância", km(a.distanceM)],
            ["Baldeações", String(a.transfers)],
            ["Tarifa", a.fare !== null ? money(a.fare) : "—"],
            ["Acompanhado por", a.mode === "gps" ? "GPS do celular" : a.mode === "sim" ? "Simulação" : "Avanço manual"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-canvas px-3 py-2">
              <dt className="text-[11px] text-muted">{k}</dt>
              <dd className="font-bold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {a.mode === "sim" && <p className="mt-2 text-xs text-muted">Trajeto simulado: a duração mostrada é a prevista para a rota.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href={redo} className="tap flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white">
            <RotateCcw className="h-4 w-4" aria-hidden /> Refazer
          </Link>
          <button type="button" onClick={onDelete} className="tap flex h-12 items-center justify-center gap-2 rounded-2xl bg-canvas text-sm font-bold text-ink">
            <Trash2 className="h-4 w-4" aria-hidden /> Excluir
          </button>
        </div>
      </div>
    </li>
  );
}

export function ActivityView() {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { announce } = useA11y();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [now] = useState(() => new Date());
  const list = useQuery({ queryKey: ACTIVITY_KEY, queryFn: () => apiFetch<{ items: Activity[] }>("/api/activity").then((d) => d.items) });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/activity/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVITY_KEY });
      toast.success("Trajeto excluído.");
      announce("Trajeto excluído da atividade.");
    },
    onError: () => toast.error("Não foi possível excluir. Tente de novo."),
  });
  const clear = useMutation({
    mutationFn: () => apiFetch("/api/activity", { method: "DELETE" }),
    onSuccess: () => {
      setConfirmClear(false);
      qc.invalidateQueries({ queryKey: ACTIVITY_KEY });
      toast.success("Histórico apagado.");
      announce("Histórico de trajetos apagado.");
    },
    onError: () => toast.error("Não foi possível apagar o histórico."),
  });

  const items = list.data ?? [];
  const month = items.filter((a) => {
    const d = new Date(a.endedAt);
    return a.status === "COMPLETED" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthMin = month.reduce((s, a) => s + tripMinutes(a), 0);
  const monthFare = month.reduce((s, a) => s + (a.fare ?? 0), 0);
  const monthName = now.toLocaleDateString("pt-BR", { month: "long" });

  // agrupa por dia, como um extrato
  const groups: { day: string; items: Activity[] }[] = [];
  for (const a of items) {
    const day = dayLabel(a.endedAt, now);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-4 pt-2">
      <header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Atividade</h1>
        <p className="mt-1 text-sm text-muted">Seus trajetos feitos no modo em trajeto: quando foi, quanto tempo levou e quanto custou.</p>
      </header>

      <section aria-label={`Resumo de ${monthName}`} className="rounded-[28px] bg-night p-5 text-white shadow-float">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Resumo de {monthName}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: Route, label: "Trajetos", value: String(month.length) },
            { icon: Clock, label: "Em viagem", value: durationLabel(monthMin) },
            { icon: Wallet, label: "Gasto", value: money(monthFare) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="min-w-0 rounded-2xl bg-white/10 p-3">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <dd className="mt-2 break-words text-lg font-extrabold leading-tight">{value}</dd>
              <dt className="text-[11px] text-white/65">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {list.isPending && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      )}
      {list.isError && <ErrorState message="Não foi possível carregar sua atividade agora." onRetry={() => list.refetch()} />}

      {list.isSuccess && items.length === 0 && (
        <EmptyState
          icon={<Route className="h-8 w-8" aria-hidden />}
          title="Nenhum trajeto ainda"
          description="Busque uma rota e toque em Iniciar trajeto. Quando você chegar, a viagem aparece aqui."
          action={{ label: "Planejar um trajeto", onClick: () => router.push("/routes") }}
        />
      )}

      {groups.map((g) => (
        <section key={g.day} aria-label={`Trajetos de ${g.day}`}>
          <h2 className="mb-2 px-1 text-sm font-extrabold text-ink">{g.day}</h2>
          <ul className="space-y-3">
            {g.items.map((a) => (
              <TripCard key={a.id} a={a} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} onDelete={() => remove.mutate(a.id)} />
            ))}
          </ul>
        </section>
      ))}

      {items.length > 0 && (
        <Button variant="ghost" className="w-full text-muted" onClick={() => setConfirmClear(true)}>
          <Trash2 className="h-4 w-4" aria-hidden /> Apagar todo o histórico
        </Button>
      )}
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => clear.mutate()}
        loading={clear.isPending}
        title="Apagar todo o histórico?"
        description="Todos os trajetos da sua atividade serão apagados. Não dá para desfazer."
        confirmLabel="Apagar tudo"
        destructive
      />
    </div>
  );
}
