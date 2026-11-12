"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorState, Skeleton } from "@/components/ui/primitives";
import type { IntegrationState } from "@/types/transit";
import { PageIntro, TableWrap, formatDateTime, td, th } from "@/components/admin/ui";

type Integration = { key: string; label: string; configured: boolean; state: IntegrationState; lastQueryAt: string | null; lastFailureAt: string | null };
type Status = { mode: "LIVE" | "DEMO"; scenario: string | null; integrations: Integration[] };

const STATE: Record<IntegrationState, { text: string; tone: "low" | "moderate" | "high" | "primary" | "unknown" }> = {
  CONNECTED: { text: "Conectado", tone: "low" },
  UPDATING: { text: "Atualizando", tone: "primary" },
  STALE: { text: "Desatualizado", tone: "moderate" },
  UNAVAILABLE: { text: "Indisponível", tone: "high" },
  DEMO: { text: "Demonstração", tone: "primary" },
};

const EXPECTED = ["API SPTrans", "Dados históricos", "Provedor de rotas", "Provedor de mapas", "Provedor de demonstração"];

export default function AdminSourcesPage() {
  const q = useQuery({ queryKey: ["admin", "system-status"], queryFn: () => apiFetch<Status>("/api/system/status"), refetchInterval: 30_000 });

  return (
    <div className="space-y-4">
      <PageIntro demo={q.data?.mode === "DEMO"}>
        <span>Apenas o estado da configuração é exibido. Segredos e tokens nunca são mostrados.</span>
      </PageIntro>

      {q.isError ? (
        <ErrorState message="Não foi possível carregar o status das integrações." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-border bg-canvas">
              <tr>
                <th className={th}>Integração</th>
                <th className={th}>Configurado</th>
                <th className={th}>Disponível</th>
                <th className={th}>Última consulta</th>
                <th className={th}>Última falha</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(q.data?.integrations.length ? q.data.integrations : EXPECTED.map((label) => ({ key: label, label, configured: false, state: "UNAVAILABLE" as const, lastQueryAt: null, lastFailureAt: null }))).map((i) => {
                const s = STATE[i.state] ?? STATE.UNAVAILABLE;
                return (
                  <tr key={i.key}>
                    <td className={`${td} font-semibold`}>{i.label}</td>
                    <td className={td}>
                      <Badge tone={i.configured ? "low" : "neutral"}>{i.configured ? "Sim" : "Não"}</Badge>
                    </td>
                    <td className={td}>{i.state === "UNAVAILABLE" ? "Não" : "Sim"}</td>
                    <td className={td}>{formatDateTime(i.lastQueryAt)}</td>
                    <td className={td}>{formatDateTime(i.lastFailureAt)}</td>
                    <td className={td}>
                      <Badge tone={s.tone}>{s.text}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
