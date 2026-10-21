"use client";

import { ArrowDownToLine, ArrowUpFromLine, Bookmark, Footprints, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { RiskPanel } from "@/features/intelligence/ui/risk-panel";
import { RiskBadge } from "@/components/ui/risk-badge";
import { TransitMap } from "@/components/maps";
import { AlertsList } from "@/features/alerts/ui/alerts-list";
import type { GeoPoint } from "@/types/transit";
import { busLineCodes } from "../risk";
import type { RouteResult } from "../types";

export function RouteDetails({
  route,
  origin,
  destination,
  onClose,
  onSave,
  saving,
}: {
  route: RouteResult;
  origin: GeoPoint;
  destination: GeoPoint;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const firstBus = route.steps.find((s) => s.kind === "BUS" && s.lineId);
  const firstLineId = firstBus && firstBus.kind === "BUS" ? firstBus.lineId : undefined;
  return (
    <Card className="overflow-hidden">
      <div className="h-64 w-full sm:h-80">
        <TransitMap vehicles={[]} highlightPath={route.path} extraPoints={[origin, destination]} fitToPath showLocate={false} className="h-full w-full" />
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Route details</h2>
            <p className="text-sm text-muted">
              {route.durationMinutes !== null ? `${route.durationMinutes} min` : "Duration unknown"} - {route.transfers} transfer{route.transfers === 1 ? "" : "s"} - {route.walkMinutes} min walking
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close route details">
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <ol className="space-y-3">
          {route.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-pressed">
                {s.kind === "WALK" ? <Footprints className="h-4 w-4" aria-hidden /> : <span className="text-[10px] font-bold">BUS</span>}
              </span>
              <div className="min-w-0 text-sm">
                {s.kind === "WALK" ? (
                  <p>Walk {s.minutes} min from <strong>{s.from}</strong> to <strong>{s.to}</strong></p>
                ) : (
                  <>
                    <p className="font-semibold">Bus {s.lineCode} <span className="font-normal text-muted">- {s.lineName}</span> ({s.minutes} min)</p>
                    <p className="flex items-center gap-1 text-muted"><ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden /> Board at {s.boardStop}</p>
                    <p className="flex items-center gap-1 text-muted"><ArrowDownToLine className="h-3.5 w-3.5" aria-hidden /> Get off at {s.alightStop}</p>
                    {route.lineRisks[s.lineCode] ? (
                      <div className="mt-1 flex items-center gap-2"><span className="text-xs text-muted">Line risk:</span><RiskBadge level={route.lineRisks[s.lineCode].level} /></div>
                    ) : (
                      <p className="mt-1 text-xs text-muted">No risk estimate for this line.</p>
                    )}
                  </>
                )}
                {s.kind === "BUS" && i < route.steps.length - 1 && route.steps[i + 1].kind === "BUS" && (
                  <p className="mt-2 rounded-lg bg-canvas px-2 py-1 text-xs text-muted">Transfer at {s.alightStop} (declared transfer point)</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {route.risk && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Estimated crowding risk ({busLineCodes(route).join(", ")})</h3>
            <RiskPanel risk={route.risk} compact />
          </div>
        )}

        {firstLineId && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Alerts</h3>
            <AlertsList lineId={firstLineId} compact limit={2} />
          </div>
        )}

        <Button onClick={onSave} loading={saving} variant="secondary" className="w-full">
          <Bookmark className="h-4 w-4" aria-hidden /> Save to favorites
        </Button>
      </div>
    </Card>
  );
}
