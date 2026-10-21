"use client";

import { Clock, Footprints, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, DemoBadge } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { cn } from "@/lib/utils";
import { busLineCodes } from "../risk";
import type { RouteResult } from "../types";

export type RouteTag = "Fastest" | "Fewer transfers" | "Lower estimated risk" | "Balanced";

const SOURCE_LABEL: Record<RouteResult["source"], string> = { DEMO: "Demonstration route", GTFS: "GTFS schedule", GOOGLE: "Google Routes" };

function time(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function RouteCard({
  route,
  tags,
  selected,
  onView,
  origin,
  destination,
}: {
  route: RouteResult;
  tags: RouteTag[];
  selected: boolean;
  onView: () => void;
  origin: string;
  destination: string;
}) {
  const codes = busLineCodes(route);
  return (
    <Card className={cn("p-4 transition-shadow", selected && "border-primary ring-2 ring-primary/20", tags.length > 0 && !selected && "border-primary/40")}>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t} tone="primary">{t}</Badge>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {codes.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted" aria-hidden>+</span>}
            <span className="rounded-lg bg-primary px-2 py-0.5 text-sm font-bold text-white">{c}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{origin} to {destination}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden /> Duration</dt>
          <dd className="font-semibold">{route.durationMinutes !== null ? `${route.durationMinutes} min` : "Unknown"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted"><Footprints className="h-3.5 w-3.5" aria-hidden /> Walking</dt>
          <dd className="font-semibold">{route.walkMinutes} min</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted"><Repeat className="h-3.5 w-3.5" aria-hidden /> Transfers</dt>
          <dd className="font-semibold">{route.transfers}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {route.risk ? <RiskBadge level={route.risk.level} /> : <RiskBadge level="INSUFFICIENT_DATA" />}
        {route.source === "DEMO" && <DemoBadge />}
      </div>
      <p className="mt-2 text-xs text-muted">
        Data as of {time(route.dataTimestamp)} - Source: {SOURCE_LABEL[route.source]}
      </p>
      <Button className="mt-3 w-full" variant={selected ? "primary" : "secondary"} onClick={onView} aria-pressed={selected}>
        View route
      </Button>
    </Card>
  );
}
