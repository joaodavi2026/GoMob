"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ChevronRight, Map as MapIcon, Radio, Search, Star, TriangleAlert, X } from "lucide-react";
import { ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AskGobi } from "@/features/assistant/gobi";
import { fleetDir, useFleet, useNetwork, type NetDir, type NetLine } from "@/features/network/data";
import { railInfo, titleCase } from "@/features/network/rail";
import { useFavoriteLines } from "./favorites";
import { LineBadge } from "./line-badge";

type Tab = "alerts" | "fav" | "all" | "bus" | "metro" | "cptm";
const TABS: { id: Tab; label: string }[] = [
  { id: "alerts", label: "Alertas" },
  { id: "fav", label: "Favoritas" },
  { id: "all", label: "Todos" },
  { id: "bus", label: "Ônibus" },
  { id: "metro", label: "Metrô" },
  { id: "cptm", label: "CPTM" },
];
const PAGE = 40;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Hora de São Paulo no navegador: dia (0 = segunda) e minuto do dia. */
function spClock(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")), hour: Number(get("hour")), minute: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export function dirRuns(dir: Pick<NetDir, "days" | "first" | "last">, when: Date): boolean {
  const { day, minute } = spClock(when);
  if (dir.days && day >= 0 && dir.days[day] !== "1") return false;
  if (!dir.first || !dir.last) return true;
  const a = toMin(dir.first);
  const b = toMin(dir.last);
  return a <= b ? minute >= a && minute <= b : minute >= a || minute <= b;
}
export const lineRuns = (l: NetLine, when: Date) => l.dirs.some((d) => dirRuns(d, when));
export function dirHeadway(dir: Pick<NetDir, "freq" | "minHeadway">, when: Date): number | null {
  const { hour } = spClock(when);
  return dir.freq.find((f) => f[0] === hour)?.[1] ?? dir.minHeadway ?? null;
}

export const lineTitle = (l: NetLine) => {
  const r = railInfo(l.code);
  return r ? r.name : titleCase(l.name);
};
export const lineHref = (code: string) => `/lines/${encodeURIComponent(code)}`;

function Row({ line, now, fav, alert }: { line: NetLine; now: Date; fav: boolean; alert?: { tone: "warn" | "info"; text: string } }) {
  const running = lineRuns(line, now);
  const rail = railInfo(line.code);
  return (
    <li>
      <Link href={lineHref(line.code)} className="flex items-center gap-3 px-4 py-3.5">
        <LineBadge code={line.code} color={line.color} type={line.type} />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] font-bold leading-snug text-ink">{lineTitle(line)}</span>
          {rail && <span className="block truncate text-xs text-muted">{titleCase(line.name)}</span>}
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold", running ? "text-[#0f7a37]" : "text-muted")}>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", running ? "bg-risk-low" : "bg-risk-unknown")} aria-hidden />
            {running ? "Operando agora" : "Fora do horário"}
          </span>
          {alert && (
            <span className={cn("mt-0.5 flex items-start gap-1 text-xs font-semibold", alert.tone === "warn" ? "text-[#b45309]" : "text-muted")}>
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {alert.text}
            </span>
          )}
        </span>
        {fav && <Star className="h-4 w-4 shrink-0 fill-primary text-primary" aria-label="Favorita" />}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

function Section({ title, kind, children }: { title: string; kind: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="flex items-center justify-between bg-canvas px-4 py-2.5 text-sm font-semibold text-muted">
        <span>{title}</span>
        <span>{kind}</span>
      </h2>
      <ul className="divide-y divide-border bg-white">{children}</ul>
    </section>
  );
}

export function LinesView() {
  const net = useNetwork();
  const favs = useFavoriteLines();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(norm(query.trim()));
  const [shown, setShown] = useState(PAGE);
  const [now] = useState(() => new Date());
  const fleet = useFleet(tab === "alerts");

  const lines = useMemo(() => net.data?.lines ?? [], [net.data]);
  const match = useMemo(() => {
    if (!q) return lines;
    return lines.filter((l) => {
      const r = railInfo(l.code);
      return norm(l.code).includes(q) || norm(l.name).includes(q) || (r && (norm(r.name).includes(q) || `linha ${r.number}` === q || r.number === q));
    });
  }, [lines, q]);

  const byNumber = (a: NetLine, b: NetLine) => Number(railInfo(a.code)?.number ?? 99) - Number(railInfo(b.code)?.number ?? 99);
  const metro = match.filter((l) => l.type === 1).sort(byNumber);
  const cptm = match.filter((l) => l.type === 2).sort(byNumber);
  const bus = match.filter((l) => l.type === 3);
  const favLines = match.filter((l) => favs.includes(l.code));

  // alertas das linhas favoritas (ou das mais frequentes, se não houver favoritas), com a frota ao vivo
  const alerts = useMemo(() => {
    if (tab !== "alerts") return [];
    const watch = favLines.length ? favLines : [...bus].sort((a, b) => (a.dirs[0]?.minHeadway ?? 99) - (b.dirs[0]?.minHeadway ?? 99)).slice(0, 12);
    const live = fleet.data?.state === "LIVE" ? fleet.data.vehicles : null;
    const out: { line: NetLine; tone: "warn" | "info"; text: string }[] = [];
    for (const l of watch) {
      if (l.type !== 3) continue;
      if (!lineRuns(l, now)) {
        out.push({ line: l, tone: "info", text: `Fora do horário: volta às ${l.dirs[0]?.first ?? "—"}` });
        continue;
      }
      if (!live) continue;
      for (const d of l.dirs) {
        if (!dirRuns(d, now)) continue;
        const n = live.filter((v) => v[0] === l.code && fleetDir(v[1]) === d.d).length;
        if (n === 0) out.push({ line: l, tone: "warn", text: `Nenhum ônibus circulando agora no sentido ${titleCase(d.headsign)}` });
        else if (n < 3 && (d.minHeadway ?? 99) <= 15) out.push({ line: l, tone: "warn", text: `Só ${n} ônibus no sentido ${titleCase(d.headsign)}: intervalo pode estar maior` });
      }
    }
    return out;
  }, [tab, favLines, bus, fleet.data, now]);

  const pick = (t: Tab) => {
    setTab(t);
    setShown(PAGE);
  };

  return (
    <div className="mx-auto max-w-xl pb-4 pt-2">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Linhas</h1>
          <p className="mt-1 text-sm text-muted">Ônibus, metrô e trem de São Paulo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/network" className="tap flex h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-ink shadow-soft">
            <MapIcon className="h-4 w-4 text-primary" aria-hidden /> Mapa da rede
          </Link>
          <Link href="/map" className="tap flex h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-ink shadow-soft">
            <Radio className="h-4 w-4 text-primary" aria-hidden /> Ao vivo
          </Link>
        </div>
      </header>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          aria-label="Pesquise uma linha"
          placeholder="Pesquise uma linha"
          className="h-14 w-full rounded-2xl border border-transparent bg-white pl-12 pr-12 text-base text-ink shadow-soft outline-none placeholder:text-muted focus:border-primary [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      <AskGobi className="mt-4" />

      <div className="no-scrollbar -mx-5 mt-4 flex gap-1 overflow-x-auto border-b border-border px-5 sm:mx-0 sm:px-0" role="tablist" aria-label="Filtrar linhas">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => pick(t.id)}
            className={cn("flex h-12 shrink-0 items-center gap-1.5 border-b-[3px] px-3.5 text-sm font-bold", tab === t.id ? "border-primary text-ink" : "border-transparent text-muted")}
          >
            {t.id === "fav" && <Star className={cn("h-4 w-4", tab === "fav" && "fill-primary text-primary")} aria-hidden />}
            {t.label}
          </button>
        ))}
      </div>

      <div className="-mx-5 overflow-hidden sm:mx-0 sm:mt-3 sm:rounded-3xl sm:shadow-soft" role="tabpanel">
        {net.isPending ? (
          <div className="space-y-px bg-white p-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="mb-3 h-11 w-full rounded-2xl" />
            ))}
          </div>
        ) : net.isError ? (
          <div className="p-4">
            <ErrorState message="Não foi possível carregar as linhas agora." onRetry={() => net.refetch()} />
          </div>
        ) : tab === "alerts" ? (
          <Section title={favLines.length ? "Suas linhas favoritas" : "Linhas mais frequentes"} kind="Alertas">
            {fleet.isPending ? (
              <li className="p-4">
                <Skeleton className="h-11 w-full rounded-2xl" />
              </li>
            ) : alerts.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">Nenhum alerta agora: as linhas acompanhadas estão circulando normalmente.</li>
            ) : (
              alerts.map((a, i) => <Row key={`${a.line.code}-${i}`} line={a.line} now={now} fav={favs.includes(a.line.code)} alert={{ tone: a.tone, text: a.text }} />)
            )}
            <li className="px-4 py-3 text-xs text-muted">
              {fleet.data?.state === "LIVE" ? "Alertas calculados com a posição dos ônibus ao vivo (SPTrans) e o horário programado." : "Posição dos ônibus indisponível agora: mostrando só o horário programado."}
              {!favLines.length && " Favorite linhas (estrela na tela da linha) para acompanhar as suas."}
            </li>
          </Section>
        ) : tab === "fav" ? (
          <Section title="Suas linhas" kind="Favoritas">
            {favLines.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">{favs.length ? "Nenhuma favorita com esse nome." : "Você ainda não favoritou linhas. Abra uma linha e toque em Favorito."}</li>
            ) : (
              favLines.map((l) => <Row key={l.id} line={l} now={now} fav />)
            )}
          </Section>
        ) : (
          <>
            {(tab === "all" || tab === "metro") && metro.length > 0 && (
              <Section title="Metrô de São Paulo" kind="Metrô">
                {metro.map((l) => (
                  <Row key={l.id} line={l} now={now} fav={favs.includes(l.code)} />
                ))}
              </Section>
            )}
            {(tab === "all" || tab === "cptm") && cptm.length > 0 && (
              <Section title="CPTM" kind="Trem">
                {cptm.map((l) => (
                  <Row key={l.id} line={l} now={now} fav={favs.includes(l.code)} />
                ))}
              </Section>
            )}
            {(tab === "all" || tab === "bus") && bus.length > 0 && (
              <Section title="SPTrans" kind={`Ônibus · ${bus.length}`}>
                {bus.slice(0, shown).map((l) => (
                  <Row key={l.id} line={l} now={now} fav={favs.includes(l.code)} />
                ))}
                {bus.length > shown && (
                  <li className="p-3">
                    <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="tap h-12 w-full rounded-2xl bg-canvas text-sm font-bold text-ink">
                      Mostrar mais linhas ({bus.length - shown} restantes)
                    </button>
                  </li>
                )}
              </Section>
            )}
            {((tab === "all" && match.length === 0) || (tab === "bus" && bus.length === 0) || (tab === "metro" && metro.length === 0) || (tab === "cptm" && cptm.length === 0)) && (
              <p className="bg-white px-4 py-8 text-center text-sm text-muted">Nenhuma linha encontrada{query ? ` para "${query}"` : ""}.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
