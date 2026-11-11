"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  Accessibility,
  ArrowLeft,
  Bus,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Layers,
  MapPin,
  Moon,
  Radio,
  Ticket,
  TrainFront,
  TramFront,
  X,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
  MODES,
  REGIONS,
  SHAPES_URL,
  brl,
  daysLabel,
  fleetDir,
  modeLabel,
  regionLabel,
  useFleet,
  useNetwork,
  useNetworkIndex,
  type NetLine,
  type Network,
} from "../data";

const NetworkMap = dynamic(() => import("./network-map"), { ssr: false });

const ModeIcon = ({ type, className }: { type: number; className?: string }) =>
  type === 1 ? <TramFront className={className} aria-hidden /> : type === 2 ? <TrainFront className={className} aria-hidden /> : <Bus className={className} aria-hidden />;

function LineBadge({ line, className }: { line: Pick<NetLine, "code" | "color" | "textColor">; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-4", className)}
      style={{ background: line.color, color: line.textColor }}
    >
      {line.code}
    </span>
  );
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function NetworkExplorer() {
  const netQ = useNetwork();
  if (netQ.isError)
    return (
      <Shell>
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
          The GTFS network could not be loaded. Run <code className="mx-1 rounded bg-white px-1">npx tsx scripts/build-gtfs.ts</code> and reload.
        </div>
      </Shell>
    );
  if (!netQ.data)
    return (
      <Shell>
        <div className="flex h-full items-center justify-center">
          <div className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-ink shadow-soft">Loading the São Paulo network…</div>
        </div>
      </Shell>
    );
  return <Explorer network={netQ.data} />;
}

/** Área de mapa em tela cheia dentro do shell (abaixo do header, acima da navegação mobile). */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-16 top-14 z-20 overflow-hidden bg-canvas lg:bottom-0 lg:left-60">{children}</div>;
}

function Explorer({ network }: { network: Network }) {
  const { byCode, stopLines } = useNetworkIndex(network);

  const [query, setQuery] = useState("");
  const q = useDeferredValue(query);
  const [modes, setModes] = useState<number[]>([3, 1, 2]);
  const [regions, setRegions] = useState<string[]>([]);
  // deep-link ?line=CODE
  const [selectedLine, setSelectedLine] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const code = new URLSearchParams(window.location.search).get("line");
    const li = code ? network.lines.findIndex((l) => l.code === code) : -1;
    return li >= 0 ? li : null;
  });
  const [selectedDir, setSelectedDir] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [focusStop, setFocusStop] = useState<number | null>(null);
  const [showStops, setShowStops] = useState(true);
  const [showLive, setShowLive] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [dark, setDark] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const fleetQ = useFleet(showLive);
  const fleet = fleetQ.data;
  const vehicles = useMemo(() => (fleet?.state === "LIVE" ? fleet.vehicles : []), [fleet]);

  const liveByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vehicles) m.set(v[0], (m.get(v[0]) ?? 0) + 1);
    return m;
  }, [vehicles]);

  const selectLine = useCallback(
    (li: number | null) => {
      setSelectedLine(li);
      setSelectedDir(null);
      setSelectedStop(null);
      setPanelOpen(true);
      const url = new URL(window.location.href);
      if (li === null) url.searchParams.delete("line");
      else url.searchParams.set("line", network.lines[li].code);
      window.history.replaceState(null, "", url);
    },
    [network],
  );
  const selectStop = useCallback((si: number) => {
    setSelectedStop(si);
    setFocusStop(si);
    setPanelOpen(true);
  }, []);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    const out: number[] = [];
    network.lines.forEach((l, i) => {
      if (!modes.includes(l.type)) return;
      if (regions.length && l.type === 3 && !regions.includes(l.color)) return;
      if (nq && !norm(`${l.code} ${l.name} ${l.dirs.map((d) => d.headsign).join(" ")}`).includes(nq)) return;
      out.push(i);
    });
    // trilhos primeiro, depois ônibus por código
    out.sort((a, b) => {
      const la = network.lines[a], lb = network.lines[b];
      return (la.type === 3 ? 1 : 0) - (lb.type === 3 ? 1 : 0) || la.code.localeCompare(lb.code, "pt-BR", { numeric: true });
    });
    return out;
  }, [network, q, modes, regions]);

  const stopResults = useMemo(() => {
    const nq = norm(q.trim());
    if (nq.length < 3) return [];
    const out: number[] = [];
    for (let i = 0; i < network.stops.length && out.length < 8; i++) if (norm(network.stops[i][1]).includes(nq)) out.push(i);
    return out;
  }, [network, q]);

  const toggleMode = (t: number) => setModes((m) => (m.includes(t) ? (m.length > 1 ? m.filter((x) => x !== t) : m) : [...m, t]));
  const toggleRegion = (c: string) => setRegions((r) => (r.includes(c) ? r.filter((x) => x !== c) : [...r, c]));

  const liveTotal = vehicles.length;
  const liveLabel =
    !showLive ? "Off" : fleetQ.isPending ? "…" : fleet?.state === "LIVE" ? liveTotal.toLocaleString("en-US") : "Offline";

  return (
    <Shell>
      <NetworkMap
        network={network}
        shapesUrl={SHAPES_URL}
        byCode={byCode}
        stopLines={stopLines}
        selectedLine={selectedLine}
        selectedDir={selectedDir}
        focusStop={focusStop}
        modes={modes}
        regions={regions}
        showStops={showStops}
        showLive={showLive}
        heatmap={heatmap}
        dark={dark}
        vehicles={vehicles}
        onSelectLine={selectLine}
        onSelectStop={selectStop}
      />

      {/* Camadas */}
      <div className="absolute right-[52px] top-2.5 z-10 flex flex-col gap-1.5 sm:flex-row" role="group" aria-label="Map layers">
        <LayerToggle on={showLive} onClick={() => setShowLive((v) => !v)} icon={<Radio className="h-4 w-4" aria-hidden />} label="Live buses" />
        <LayerToggle on={heatmap} disabled={!showLive} onClick={() => setHeatmap((v) => !v)} icon={<Flame className="h-4 w-4" aria-hidden />} label="Heatmap" />
        <LayerToggle on={showStops} onClick={() => setShowStops((v) => !v)} icon={<MapPin className="h-4 w-4" aria-hidden />} label="Stops" />
        <LayerToggle on={dark} onClick={() => setDark((v) => !v)} icon={<Moon className="h-4 w-4" aria-hidden />} label="Dark" />
      </div>

      {/* Legenda das regiões */}
      <div className="absolute bottom-8 right-2.5 z-10 hidden rounded-xl bg-white/95 p-2.5 shadow-soft backdrop-blur md:block">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Layers className="h-3.5 w-3.5" aria-hidden /> SPTrans regions
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {REGIONS.map((r) => {
            const on = regions.length === 0 || regions.includes(r.color);
            return (
              <button
                key={r.color}
                type="button"
                onClick={() => toggleRegion(r.color)}
                aria-pressed={regions.includes(r.color)}
                className={cn("flex items-center gap-1.5 rounded px-1 text-left text-xs transition-opacity hover:bg-canvas", !on && "opacity-35")}
              >
                <span className="h-2.5 w-4 rounded-sm" style={{ background: r.color }} />
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel */}
      <section
        aria-label="Network explorer"
        className={cn(
          "absolute z-20 flex flex-col overflow-hidden bg-white shadow-[0_8px_30px_rgb(23_33_43/0.16)]",
          "inset-x-0 bottom-0 rounded-t-2xl lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-3 lg:w-[400px] lg:rounded-2xl",
          panelOpen ? "max-h-[58%] lg:max-h-none" : "max-h-[64px] lg:max-h-[64px]",
        )}
      >
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 text-left"
          aria-expanded={panelOpen}
        >
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">São Paulo transit network</h1>
            <p className="truncate text-xs text-muted">
              {network.counts.lines.toLocaleString("en-US")} lines · {network.counts.stops.toLocaleString("en-US")} stops · live buses: {liveLabel}
            </p>
          </div>
          {panelOpen ? <ChevronDown className="h-5 w-5 shrink-0 text-muted" aria-hidden /> : <ChevronUp className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {selectedLine !== null ? (
            <LineDetail
              network={network}
              li={selectedLine}
              dir={selectedDir}
              onDir={setSelectedDir}
              onBack={() => selectLine(null)}
              onStop={(si) => {
                setSelectedStop(null);
                setFocusStop(si);
              }}
              stopLines={stopLines}
              vehicles={vehicles}
              liveState={showLive ? (fleet?.state ?? null) : null}
            />
          ) : selectedStop !== null ? (
            <StopDetail network={network} si={selectedStop} lines={stopLines[selectedStop] ?? []} liveByCode={liveByCode} onBack={() => setSelectedStop(null)} onLine={selectLine} />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Lines" value={network.counts.lines.toLocaleString("en-US")} />
                <Stat label="Stops" value={network.counts.stops.toLocaleString("en-US")} />
                <Stat label="Buses now" value={liveLabel} accent={fleet?.state === "LIVE" && showLive} />
              </div>

              {showLive && fleet?.state === "UNAVAILABLE" && <LiveNotice reason={fleet.reason} />}

              <SearchInput value={query} onValueChange={setQuery} aria-label="Search lines or stops" placeholder="Line number, destination or stop" />

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modes">
                {MODES.map((m) => (
                  <Chip key={m.type} on={modes.includes(m.type)} onClick={() => toggleMode(m.type)}>
                    <ModeIcon type={m.type} className="h-3.5 w-3.5" />
                    {m.label}
                    <span className="text-muted">{network.lines.filter((l) => l.type === m.type).length}</span>
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 md:hidden" role="group" aria-label="Regions">
                {REGIONS.map((r) => (
                  <Chip key={r.color} on={regions.includes(r.color)} onClick={() => toggleRegion(r.color)}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                    {r.label}
                  </Chip>
                ))}
              </div>
              {regions.length > 0 && (
                <button type="button" className="self-start text-xs font-medium text-primary hover:underline" onClick={() => setRegions([])}>
                  Clear region filter ({regions.map((c) => regionLabel(c)).join(", ")})
                </button>
              )}

              {stopResults.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Stops</p>
                  <ul className="flex flex-col">
                    {stopResults.map((si) => (
                      <li key={si}>
                        <button type="button" onClick={() => selectStop(si)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-canvas">
                          <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{network.stops[si][1]}</span>
                          <span className="text-xs text-muted">{stopLines[si]?.length ?? 0} lines</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {results.length.toLocaleString("en-US")} line{results.length === 1 ? "" : "s"}
                  {results.length > 150 && " · showing 150"}
                </p>
                <ul className="flex flex-col">
                  {results.slice(0, 150).map((li) => {
                    const l = network.lines[li];
                    const live = liveByCode.get(l.code) ?? 0;
                    return (
                      <li key={l.id}>
                        <button type="button" onClick={() => selectLine(li)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-canvas">
                          <LineBadge line={l} className="min-w-[64px]" />
                          <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                          {live > 0 && (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-risk-low" title={`${live} buses live`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-risk-low" /> {live}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {results.length === 0 && <p className="py-6 text-center text-sm text-muted">No lines match these filters.</p>}
              </div>
              <p className="pb-1 text-[11px] text-muted">
                Source: {network.agency.name} GTFS · built {new Date(network.generatedAt).toLocaleDateString("pt-BR")}. Live positions: Olho Vivo API.
              </p>
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

function LayerToggle({ on, onClick, icon, label, disabled }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={label}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-soft transition-colors disabled:opacity-40",
        on ? "border-primary bg-primary text-white" : "border-border bg-white text-ink hover:bg-canvas",
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        on ? "border-primary bg-primary-light text-primary-pressed" : "border-border bg-white text-ink hover:bg-canvas",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-canvas px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("flex items-center gap-1.5 text-lg font-bold tabular-nums", accent && "text-risk-low")}>
        {accent && <span className="h-2 w-2 animate-pulse rounded-full bg-risk-low" />}
        {value}
      </p>
    </div>
  );
}

function LiveNotice({ reason }: { reason: "NOT_CONFIGURED" | "AUTH" | "RATE_LIMIT" | "ERROR" }) {
  const msg = {
    NOT_CONFIGURED: "Add SPTRANS_API_TOKEN to .env.local to show live buses.",
    AUTH: "SPTrans rejected the Olho Vivo token. New tokens can take a few hours to activate; the map retries automatically.",
    RATE_LIMIT: "SPTrans is rate-limiting requests. Retrying shortly.",
    ERROR: "Could not reach SPTrans right now. Retrying shortly.",
  }[reason];
  return (
    <div className="flex gap-2 rounded-xl border border-risk-moderate/30 bg-risk-moderate/10 px-3 py-2 text-xs text-ink">
      <Radio className="mt-0.5 h-4 w-4 shrink-0 text-risk-moderate" aria-hidden />
      <span>
        <b>Live positions offline.</b> {msg}
      </span>
    </div>
  );
}

function LineDetail({
  network,
  li,
  dir,
  onDir,
  onBack,
  onStop,
  stopLines,
  vehicles,
  liveState,
}: {
  network: Network;
  li: number;
  dir: number | null;
  onDir: (d: number | null) => void;
  onBack: () => void;
  onStop: (si: number) => void;
  stopLines: number[][];
  vehicles: [string, number, number, number, string, 0 | 1, number][];
  liveState: "LIVE" | "UNAVAILABLE" | null;
}) {
  const line = network.lines[li];
  const activeDir = dir ?? line.dirs[0]?.d ?? 0;
  const d = line.dirs.find((x) => x.d === activeDir) ?? line.dirs[0];
  const live = vehicles.filter((v) => v[0] === line.code);
  const liveDir = live.filter((v) => fleetDir(v[1]) === activeDir).length;
  const accessible = live.filter((v) => v[5] === 1).length;
  const region = line.type === 3 ? regionLabel(line.color) : null;

  // ônibus por hora a partir dos intervalos (headway) do frequencies.txt
  const perHour = Array.from({ length: 24 }, (_, h) => {
    const f = d?.freq.find(([hr]) => hr === h);
    return f && f[1] > 0 ? Math.round(60 / f[1]) : 0;
  });
  const maxPerHour = Math.max(1, ...perHour);
  const nowH = new Date().getHours();

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onBack} className="-ml-1 rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Back to all lines">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LineBadge line={line} className="px-2 py-1 text-sm" />
            <span className="flex items-center gap-1 text-xs text-muted">
              <ModeIcon type={line.type} className="h-3.5 w-3.5" /> {modeLabel(line.type)}
              {region && <> · {region} region</>}
            </span>
          </div>
          <h2 className="mt-1.5 text-base font-bold leading-snug">{line.name}</h2>
        </div>
        <button type="button" onClick={onBack} className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Close line">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {line.dirs.length > 1 && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1" role="tablist" aria-label="Direction">
          {line.dirs.map((x) => (
            <button
              key={x.d}
              type="button"
              role="tab"
              aria-selected={x.d === activeDir && dir !== null}
              onClick={() => onDir(dir === x.d ? null : x.d)}
              className={cn(
                "truncate rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                x.d === activeDir && dir !== null ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
              title={`To ${x.headsign}`}
            >
              → {x.headsign}
            </button>
          ))}
        </div>
      )}
      {line.dirs.length > 1 && dir === null && <p className="-mt-1.5 text-[11px] text-muted">Showing both directions. Pick one to isolate it on the map.</p>}

      {line.dirs.length === 0 ? (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">The GTFS feed has no itinerary for this line.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Kpi icon={<Ticket className="h-4 w-4" aria-hidden />} label="Fare" value={line.fare !== null ? brl(line.fare) : "—"} />
            <Kpi icon={<Clock className="h-4 w-4" aria-hidden />} label="Best interval" value={d?.minHeadway ? `every ${d.minHeadway} min` : "—"} />
            <Kpi icon={<Clock className="h-4 w-4" aria-hidden />} label="Hours" value={d?.first ? `${d.first}–${d.last}` : "—"} sub={daysLabel(d?.days ?? null)} />
            <Kpi icon={<Bus className="h-4 w-4" aria-hidden />} label="Trip time" value={d?.trip ? `~${d.trip} min` : "—"} sub={`${d?.stops.length ?? 0} stops`} />
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Radio className={cn("h-4 w-4", live.length ? "text-risk-low" : "text-muted")} aria-hidden /> Live now
              </p>
              {liveState === "LIVE" ? (
                <p className="text-xs text-muted">
                  <b className="text-ink">{live.length}</b> buses · {liveDir} this way
                  {accessible > 0 && (
                    <>
                      {" "}
                      · <Accessibility className="inline h-3 w-3" aria-label="accessible" /> {accessible}
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted">{liveState === null ? "Live layer off" : "Unavailable"}</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Buses per hour (scheduled)</p>
            <div className="flex h-20 items-end gap-[3px]" role="img" aria-label="Scheduled departures per hour">
              {perHour.map((n, h) => (
                <div key={h} className="flex h-full flex-1 flex-col items-center justify-end" title={`${String(h).padStart(2, "0")}h: ${n}/h`}>
                  <div
                    className={cn("w-full rounded-t-sm", h === nowH ? "opacity-100" : "opacity-60")}
                    style={{ height: `${(n / maxPerHour) * 100}%`, minHeight: n ? 3 : 0, background: line.color }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Stops {d ? `→ ${d.headsign}` : ""}
            </p>
            <ol className="relative">
              {d?.stops.map((si, k) => {
                const s = network.stops[si];
                const transfers = (stopLines[si]?.length ?? 1) - 1;
                const last = k === d.stops.length - 1;
                return (
                  <li key={`${si}-${k}`} className="relative">
                    {!last && <span className="absolute left-[11px] top-4 h-full w-[3px]" style={{ background: line.color }} aria-hidden />}
                    <button type="button" onClick={() => onStop(si)} className="relative flex w-full items-center gap-3 rounded-lg py-1.5 pr-2 text-left hover:bg-canvas">
                      <span
                        className={cn("relative z-[1] shrink-0 rounded-full border-[3px] bg-white", k === 0 || last ? "h-4 w-4" : "h-3 w-3")}
                        style={{ borderColor: line.color, marginLeft: k === 0 || last ? 4 : 6 }}
                      />
                      <span className={cn("min-w-0 flex-1 truncate text-sm", (k === 0 || last) && "font-semibold")}>{s[1]}</span>
                      {transfers > 0 && <span className="shrink-0 text-[11px] text-muted">+{transfers} lines</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] text-muted">
        {icon}
        {label}
      </p>
      <p className="text-sm font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function StopDetail({
  network,
  si,
  lines,
  liveByCode,
  onBack,
  onLine,
}: {
  network: Network;
  si: number;
  lines: number[];
  liveByCode: Map<string, number>;
  onBack: () => void;
  onLine: (li: number) => void;
}) {
  const s = network.stops[si];
  const sorted = [...lines].sort((a, b) => network.lines[a].code.localeCompare(network.lines[b].code, "pt-BR", { numeric: true }));
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onBack} className="-ml-1 rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Back">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Stop {s[0]}
          </p>
          <h2 className="text-base font-bold leading-snug">{s[1]}</h2>
        </div>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {sorted.length} line{sorted.length === 1 ? "" : "s"} stop here
      </p>
      <ul className="flex flex-col">
        {sorted.map((li) => {
          const l = network.lines[li];
          const live = liveByCode.get(l.code) ?? 0;
          return (
            <li key={l.id}>
              <button type="button" onClick={() => onLine(li)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-canvas">
                <LineBadge line={l} className="min-w-[64px]" />
                <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                {live > 0 && <span className="text-xs font-medium text-risk-low">{live} live</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
