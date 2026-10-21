"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { MAX_LINES_PER_VEHICLES_REQUEST } from "@/config/transit";
import { TransitMap } from "@/components/maps/transit-map";
import { VehicleSheet } from "@/components/maps/vehicle-sheet";
import { STATUS_LABEL, deriveStatus, useLinePath, useLineStops, useLines, useNow, useVehicles } from "@/components/maps/use-transit";
import { LiveStatus, timeAgo } from "@/components/ui/indicators";
import { Button, DemoBadge, ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "@/types/transit";

export function MapView() {
  const params = useSearchParams();
  const initialLine = params.get("line");
  const linesQ = useLines();
  const now = useNow(10_000);

  const [chosen, setChosen] = useState<string[] | null>(initialLine ? [initialLine] : null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<GeoPoint | null>(null);

  const lines = useMemo(() => linesQ.data?.lines ?? [], [linesQ.data]);
  const selectedIds = useMemo(() => {
    const valid = new Set(lines.map((l) => l.id));
    const base = chosen ?? lines.filter((l) => l.active).slice(0, 3).map((l) => l.id);
    return base.filter((id) => valid.has(id)).slice(0, MAX_LINES_PER_VEHICLES_REQUEST);
  }, [chosen, lines]);

  const vehiclesQ = useVehicles(selectedIds, linesQ.isSuccess);
  const vehicles = useMemo(() => vehiclesQ.data?.vehicles ?? [], [vehiclesQ.data]);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  const focusLineId = selectedVehicle?.lineId ?? selectedIds[0] ?? null;
  const pathQ = useLinePath(focusLineId);
  const stopsQ = useLineStops(focusLineId);

  const status = deriveStatus(vehiclesQ);
  const isDemo = vehiclesQ.data?.source === "DEMO" || linesQ.data?.source === "DEMO";
  const fallback = !!(vehiclesQ.data?.fallbackFromLive || linesQ.data?.fallbackFromLive);

  function toggle(id: string) {
    setSelectedVehicleId(null);
    setChosen((prev) => {
      const cur = prev ?? selectedIds;
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-MAX_LINES_PER_VEHICLES_REQUEST);
    });
  }

  if (linesQ.isError) return <ErrorState message="Lines could not be loaded. Please try again." onRetry={() => linesQ.refetch()} />;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">Map</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Line filter" role="group">
          {linesQ.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
          {lines.map((l) => {
            const on = selectedIds.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(l.id)}
                title={l.name}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                  on ? "border-primary bg-primary-light text-primary-pressed" : "border-border bg-white text-ink hover:bg-canvas",
                )}
              >
                {l.displayCode}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <LiveStatus state={status} label={STATUS_LABEL[status]} />
        <span className="text-muted" aria-live="polite">
          {vehiclesQ.dataUpdatedAt ? timeAgo(new Date(vehiclesQ.dataUpdatedAt).toISOString(), now) : "Not updated yet"}
        </span>
        {isDemo && <DemoBadge />}
        <Button variant="ghost" size="sm" onClick={() => vehiclesQ.refetch()} disabled={vehiclesQ.isFetching || !selectedIds.length}>
          <RefreshCw className={cn("h-4 w-4", vehiclesQ.isFetching && "animate-spin")} aria-hidden /> Refresh
        </Button>
        <Button variant={pickMode ? "primary" : "secondary"} size="sm" onClick={() => setPickMode((p) => !p)} aria-pressed={pickMode}>
          <MapPin className="h-4 w-4" aria-hidden /> {pickMode ? "Tap the map" : "Pick a point"}
        </Button>
      </div>

      {fallback && (
        <p role="status" className="rounded-xl bg-primary-light px-3 py-2 text-sm">
          Live data is temporarily unavailable. Showing explicitly identified demonstration data instead.
        </p>
      )}
      {(status === "STALE" || status === "UNAVAILABLE") && !fallback && (
        <p role="status" className="rounded-xl bg-risk-moderate/10 px-3 py-2 text-sm">
          {status === "STALE" ? "Some positions are outdated and are shown dimmed; they are not confirmed current locations." : "Live data is temporarily unavailable."}
        </p>
      )}
      {picked && (
        <p className="text-sm text-muted">
          Selected point: {picked.latitude.toFixed(5)}, {picked.longitude.toFixed(5)}
        </p>
      )}

      <div className="relative h-[calc(100dvh-17rem)] min-h-[380px] overflow-hidden rounded-2xl border border-border">
        <TransitMap
          className="h-full w-full"
          vehicles={vehicles}
          stops={stopsQ.data?.stops}
          highlightPath={pathQ.data?.path}
          selectedVehicleId={selectedVehicleId}
          onSelectVehicle={setSelectedVehicleId}
          onPickPoint={pickMode ? (p) => { setPicked(p); setPickMode(false); } : undefined}
          pickedPoint={picked}
          now={now}
        >
          {!vehiclesQ.isLoading && selectedIds.length > 0 && vehicles.length === 0 && status !== "UPDATING" && (
            <p className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-white/95 p-3 text-center text-sm shadow-soft">
              No vehicle positions available for the selected lines right now.
            </p>
          )}
          {selectedVehicle && (
            <VehicleSheet
              vehicle={selectedVehicle}
              line={lines.find((l) => l.id === selectedVehicle.lineId)}
              now={now}
              onClose={() => setSelectedVehicleId(null)}
            />
          )}
        </TransitMap>
      </div>
    </div>
  );
}
