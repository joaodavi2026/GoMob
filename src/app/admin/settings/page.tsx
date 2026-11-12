"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorState, Skeleton } from "@/components/ui/primitives";
import { FACTOR_DEFINITIONS, type Weights } from "@/features/admin/weights";
import { PageIntro, Section } from "@/components/admin/ui";

type Settings = { weights: Weights; defaults: Weights; mode: "LIVE" | "DEMO"; editable: boolean; disclaimer: string };

export default function AdminSettingsPage() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => apiFetch<Settings>("/api/admin/settings") });

  return (
    <div className="space-y-4">
      <PageIntro demo={q.data?.mode === "DEMO"} />
      {q.isError ? (
        <ErrorState message="Não foi possível carregar as configurações." onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Section title="Modo de operação">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge tone={q.data.mode === "LIVE" ? "low" : "primary"}>{q.data.mode === "LIVE" ? "MODO AO VIVO" : "MODO DEMONSTRAÇÃO"}</Badge>
              <span className="text-muted">
                {q.data.mode === "LIVE"
                  ? "Há um token da SPTrans configurado no servidor. Os pesos estão bloqueados."
                  : "Nenhum token da SPTrans configurado: são usados dados de demonstração determinísticos e os pesos podem ser ajustados."}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">O modo é definido pela configuração do servidor e não pode ser alterado nesta tela.</p>
          </Section>

          <Section title="Pesos da inteligência" subtitle="Valores atuais" action={<Link href="/admin/intelligence" className="text-sm font-medium text-primary-pressed hover:underline">Editar em Inteligência</Link>}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {FACTOR_DEFINITIONS.map((f) => (
                <li key={f.key} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
                  <span>{f.label}</span>
                  <span className="font-semibold tabular-nums">{q.data.weights[f.key].toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">{q.data.disclaimer}</p>
          </Section>

          <Section title="Dados de demonstração">
            <p className="text-sm text-muted">
              Os cenários e a restauração estão disponíveis na <Link href="/admin/demo" className="font-medium text-primary-pressed hover:underline">Central de demonstração</Link>. As ações de demonstração nunca modificam os registros recebidos da SPTrans.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
