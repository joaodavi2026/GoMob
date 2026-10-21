"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import type { AdminLine } from "@/features/admin/lines";
import { classifyFreshness } from "@/features/admin/overview";
import type { TransitVehicle, IntegrationState } from "@/types/transit";
import { PageIntro, TableWrap, formatDateTime, td, th } from "@/components/admin/ui";

type VehiclesData = { vehicles: TransitVehicle[]; state: IntegrationState };

const FRESH_BADGE = { FRESH: { t: "Updated", tone: "low" }, STALE: { t: "Stale", tone: "moderate" }, UNAVAILABLE: { t: "Outdated", tone: "unknown" } } as const;

export default function AdminVehiclesPage() {
  const [lineId, setLineId] = useState("");
  const [selected, setSelected] = useState<TransitVehicle | null>(null);

  const lines = useQuery({
    queryKey: ["admin", "lines", "monitored"],
    queryFn: () => apiFetch<{ lines: AdminLine[] }>("/api/admin/lines?active=true&pageSize=100"),
  });
  const lineMap = useMemo(() => new Map((lines.data?.lines ?? []).map((l) => [l.id, l])), [lines.data]);
  const ids = lineId ? [lineId] : (lines.data?.lines ?? []).slice(0, 20).map((l) => l.id);

  const vehicles = useQuery({
    queryKey: ["admin", "vehicles", ids.join(",")],
    queryFn: () => apiFetch<VehiclesData>(`/api/vehicles?lineIds=${encodeURIComponent(ids.join(","))}`),
    enabled: ids.length > 0,
    refetchInterval: 20_000,
  });

  const now = new Date();
  const list = vehicles.data?.vehicles ?? [];
  const anyDemo = list.some((v) => v.source === "DEMO");

  return (
    <div className="space-y-4">
      <PageIntro demo={anyDemo}>
        <span>Only monitored lines are listed (up to 20 at once). Positions refresh every 20 seconds.</span>
      </PageIntro>

      <label className="block">
        <span className="sr-only">Filter by line</span>
        <select className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm sm:w-72" value={lineId} onChange={(e) => setLineId(e.target.value)}>
          <option value="">All monitored lines</option>
          {(lines.data?.lines ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.displayCode} — {l.name}
            </option>
          ))}
        </select>
      </label>

      {lines.isError ? (
        <ErrorState message="Could not load lines." onRetry={() => lines.refetch()} />
      ) : lines.isSuccess && ids.length === 0 ? (
        <EmptyState title="No monitored lines" description="Enable monitoring in Bus Lines to see vehicles here." />
      ) : vehicles.isError ? (
        <ErrorState message={vehicles.error instanceof Error ? vehicles.error.message : "Could not load vehicles."} onRetry={() => vehicles.refetch()} />
      ) : vehicles.isLoading || lines.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <EmptyState title="No vehicles reported" description="The source returned no vehicles for the selection (state: unavailable or no observations)." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <TableWrap>
            <table className="w-full min-w-[680px]">
              <thead className="border-b border-border bg-canvas">
                <tr>
                  <th className={th}>Vehicle</th>
                  <th className={th}>Line</th>
                  <th className={th}>Last position</th>
                  <th className={th}>Time</th>
                  <th className={th}>Source</th>
                  <th className={th}>State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((v) => {
                  const f = FRESH_BADGE[classifyFreshness(v.observedAt, now)];
                  return (
                    <tr key={v.id} onClick={() => setSelected(v)} className="cursor-pointer hover:bg-canvas">
                      <td className={`${td} font-semibold`}>
                        <button className="text-left underline-offset-2 hover:underline" onClick={() => setSelected(v)}>
                          {v.id}
                        </button>
                      </td>
                      <td className={td}>{lineMap.get(v.lineId)?.displayCode ?? v.lineId}</td>
                      <td className={`${td} tabular-nums`}>
                        {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}
                      </td>
                      <td className={td}>{formatDateTime(v.observedAt)}</td>
                      <td className={td}>
                        <Badge tone={v.source === "DEMO" ? "primary" : "neutral"}>{v.source === "DEMO" ? "Demo" : "SPTrans"}</Badge>
                      </td>
                      <td className={td}>
                        <Badge tone={f.tone}>{f.t}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>

          {selected && (
            <Card className="h-fit p-5">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold">Vehicle {selected.id}</h2>
                <button aria-label="Close details" onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-canvas">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-muted">Line</dt>
                  <dd>{lineMap.get(selected.lineId) ? `${lineMap.get(selected.lineId)!.displayCode} — ${lineMap.get(selected.lineId)!.name}` : selected.lineId}</dd>
                </div>
                <div>
                  <dt className="text-muted">Coordinates</dt>
                  <dd className="tabular-nums">
                    {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Observed at</dt>
                  <dd>{formatDateTime(selected.observedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Source</dt>
                  <dd>{selected.source === "DEMO" ? "Demonstration data (not a real vehicle position)" : "SPTrans Olho Vivo"}</dd>
                </div>
              </dl>
              <Link href={`/map?vehicle=${encodeURIComponent(selected.id)}`} className="mt-4 block">
                <Button className="w-full">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Locate on map
                </Button>
              </Link>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
