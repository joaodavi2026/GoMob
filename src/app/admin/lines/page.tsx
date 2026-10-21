"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AdminLine } from "@/features/admin/lines";
import { PageIntro, TableWrap, formatDateTime, td, th } from "@/components/admin/ui";

type Data = { lines: AdminLine[]; total: number; page: number; pageSize: number };

export default function AdminLinesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [source, setSource] = useState<"" | "SPTRANS" | "DEMO">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (debounced) params.set("search", debounced);
  if (active) params.set("active", active);
  if (source) params.set("source", source);

  const q = useQuery({ queryKey: ["admin", "lines", params.toString()], queryFn: () => apiFetch<Data>(`/api/admin/lines?${params}`) });

  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => apiFetch<{ line: AdminLine }>("/api/admin/lines", { method: "PATCH", body: JSON.stringify(v) }),
    onSuccess: (r) => {
      toast.success(`${r.line.displayCode} monitoring ${r.line.active ? "enabled" : "disabled"}.`);
      qc.invalidateQueries({ queryKey: ["admin", "lines"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the line."),
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  const sel = "h-11 rounded-xl border border-border bg-white px-3 text-sm";

  return (
    <div className="space-y-4">
      <PageIntro>
        <span>Enabling or disabling monitoring only changes GoMob&apos;s internal configuration. It never alters SPTrans data.</span>
      </PageIntro>

      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Search lines</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name"
            className="h-11 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm"
          />
        </label>
        <select aria-label="Filter by status" className={sel} value={active} onChange={(e) => { setActive(e.target.value as typeof active); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="true">Monitored</option>
          <option value="false">Not monitored</option>
        </select>
        <select aria-label="Filter by source" className={sel} value={source} onChange={(e) => { setSource(e.target.value as typeof source); setPage(1); }}>
          <option value="">All sources</option>
          <option value="SPTRANS">SPTrans</option>
          <option value="DEMO">Demo</option>
        </select>
      </div>

      {q.isError ? (
        <ErrorState message={q.error instanceof Error ? q.error.message : "Could not load lines."} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.data && q.data.lines.length === 0 ? (
        <EmptyState title="No lines found" description="Adjust the filters, or sync lines first (seed or SPTrans sync)." />
      ) : (
        q.data && (
          <>
            <TableWrap>
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-border bg-canvas">
                  <tr>
                    <th className={th}>Code</th>
                    <th className={th}>Name</th>
                    <th className={th}>Direction</th>
                    <th className={th}>Source</th>
                    <th className={th}>Status</th>
                    <th className={th}>Last sync</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {q.data.lines.map((l) => (
                    <tr key={l.id}>
                      <td className={`${td} font-semibold`}>{l.displayCode}</td>
                      <td className={td}>{l.name}</td>
                      <td className={td}>{`Direction ${l.direction}`}</td>
                      <td className={td}>
                        <Badge tone={l.source === "DEMO" ? "primary" : "neutral"}>{l.source === "DEMO" ? "Demo" : "SPTrans"}</Badge>
                      </td>
                      <td className={td}>
                        <Badge tone={l.active ? "low" : "neutral"}>{l.active ? "Monitored" : "Not monitored"}</Badge>
                      </td>
                      <td className={td}>{formatDateTime(l.lastSyncedAt)}</td>
                      <td className={`${td} text-right`}>
                        <Button
                          size="sm"
                          variant={l.active ? "secondary" : "primary"}
                          loading={toggle.isPending && toggle.variables?.id === l.id}
                          onClick={() => toggle.mutate({ id: l.id, active: !l.active })}
                        >
                          {l.active ? "Disable" : "Enable"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                {q.data.total} line{q.data.total === 1 ? "" : "s"} · page {q.data.page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
