"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge, Card, DemoBadge, ErrorState, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SCENARIOS, type ScenarioView } from "@/features/admin/scenario";
import type { DemoScenario } from "@/types/transit";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/admin/ui";

type Data = { state: ScenarioView; scenarios: typeof SCENARIOS };

export default function AdminDemoPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "demo"], queryFn: () => apiFetch<Data>("/api/admin/demo"), refetchInterval: 10_000 });

  const run = useMutation({
    mutationFn: (body: { scenario: DemoScenario } | { reset: true }) => apiFetch<Data>("/api/admin/demo", { method: "POST", body: JSON.stringify(body) }),
    onMutate: (b) => setPending("reset" in b ? "reset" : b.scenario),
    onSuccess: (d, b) => {
      qc.setQueryData(["admin", "demo"], d);
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("reset" in b ? "Demonstração restaurada para o Cenário A." : `${d.state.title} agora está ativo.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível alterar o cenário."),
    onSettled: () => setPending(null),
  });

  const active = q.data?.state;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge label="Dados de demonstração — hipotéticos, não oficiais" />
        <span className="text-sm text-muted">Os cenários afetam apenas os provedores de demonstração. Os registros reais da SPTrans nunca são alterados.</span>
      </div>

      <Card className="p-5">
        <p className="text-sm text-muted">Cenário ativo</p>
        {q.isError ? (
          <ErrorState message="Não foi possível carregar o estado da demonstração." onRetry={() => q.refetch()} />
        ) : !active ? (
          <Skeleton className="mt-2 h-10 w-64" />
        ) : (
          <>
            <p className="mt-1 text-xl font-bold">{active.title}</p>
            <p className="mt-1 text-sm text-muted">
              {active.setAt ? `Definido por ${active.setByName ?? active.setBy ?? "desconhecido"} em ${formatDateTime(active.setAt)}` : "Cenário padrão (nunca alterado)"}
            </p>
            {active.scenario === "D_RECOVERY" && active.recoveryStartedAt && (
              <p className="mt-1 text-sm text-muted">Recuperação iniciada em {formatDateTime(active.recoveryStartedAt)}.</p>
            )}
          </>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {SCENARIOS.map((s) => {
          const isActive = active?.scenario === s.id;
          return (
            <Card key={s.id} className={cn("flex flex-col gap-3 p-5", isActive && "border-primary ring-1 ring-primary")}>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-sm font-bold text-primary-pressed">{s.letter}</span>
                <h2 className="font-semibold">{s.title}</h2>
                {isActive && (
                  <Badge tone="low" className="ml-auto">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> Ativo
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted">{s.description}</p>
              <Button className="mt-auto" variant={isActive ? "secondary" : "primary"} loading={pending === s.id} disabled={run.isPending} onClick={() => run.mutate({ scenario: s.id })}>
                {isActive ? "Executar novamente" : "Executar cenário"}
              </Button>
            </Card>
          );
        })}
      </div>

      <div>
        <Button variant="secondary" loading={pending === "reset"} disabled={run.isPending} onClick={() => run.mutate({ reset: true })}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Restaurar demonstração
        </Button>
        <p className="mt-2 text-xs text-muted">As telas abertas recebem a alteração por atualização periódica. Cada alteração é registrada no log de auditoria com autor e horário.</p>
      </div>
    </div>
  );
}
