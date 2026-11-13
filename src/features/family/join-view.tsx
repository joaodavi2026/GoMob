"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Button, Logo, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Status = { kind: "NEW" } | { kind: "MEMBER"; name: string } | { kind: "INVALID" } | { kind: "FULL" };

/** Tela do link de convite: a pessoa digita o nome e entra na família, sem senha. */
export function JoinView({ code }: { code: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = useQuery({
    queryKey: ["invite", code],
    retry: 0,
    queryFn: () => apiFetch<{ status: Status; ownerName: string }>(`/api/family/join?code=${encodeURIComponent(code)}`),
  });

  const join = async () => {
    setError(null);
    const status = info.data?.status;
    if (status?.kind === "NEW" && name.trim().length < 2) return setError("Digite seu nome para entrar.");
    setBusy(true);
    try {
      await apiFetch("/api/family/join", { method: "POST", body: JSON.stringify(status?.kind === "NEW" ? { code, name: name.trim() } : { code }) });
      // recarrega o app inteiro, já com o perfil do familiar
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/family");
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  };

  const status = info.data?.status;
  const owner = info.data?.ownerName ?? "Alguém";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-float">
        <Logo priority className="mx-auto h-24 w-24" />
        {info.isPending ? (
          <div className="mt-4 space-y-3" aria-busy="true">
            <Skeleton className="mx-auto h-6 w-3/4" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ) : !status || status.kind === "INVALID" ? (
          <>
            <h1 className="mt-3 text-xl font-extrabold text-ink">Este convite não vale mais</h1>
            <p className="mt-2 text-sm text-muted">Peça um novo link para quem convidou você.</p>
            <Link href="/home" className="tap mt-5 flex h-12 items-center justify-center rounded-2xl bg-night text-sm font-bold text-white">
              Abrir o GoMob
            </Link>
          </>
        ) : status.kind === "FULL" ? (
          <>
            <h1 className="mt-3 text-xl font-extrabold text-ink">A família já está completa</h1>
            <p className="mt-2 text-sm text-muted">A família de {owner} já tem o máximo de pessoas.</p>
            <Link href="/home" className="tap mt-5 flex h-12 items-center justify-center rounded-2xl bg-night text-sm font-bold text-white">
              Abrir o GoMob
            </Link>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <span className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-3 text-xl font-extrabold leading-snug text-ink">{status.kind === "MEMBER" ? `Olá de novo, ${status.name}` : `${owner} convidou você para a família no GoMob`}</h1>
            <p className="mt-2 text-sm text-muted">
              {status.kind === "MEMBER" ? `Entre para continuar acompanhando a família de ${owner}.` : "Vocês poderão acompanhar os trajetos de ônibus um do outro ao vivo. Não precisa de senha."}
            </p>
            {status.kind === "NEW" && (
              <div className="mt-5 text-left">
                <label htmlFor="join-name" className="mb-1 block text-xs font-semibold text-muted">
                  Seu nome
                </label>
                <input
                  id="join-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 30))}
                  autoComplete="given-name"
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? "join-err" : undefined}
                  placeholder="Como a família chama você"
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-base text-ink outline-none focus:border-primary"
                />
              </div>
            )}
            {error && (
              <p id="join-err" role="alert" className="mt-2 text-left text-sm font-semibold text-risk-high">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="mt-4 w-full" loading={busy}>
              {status.kind === "MEMBER" ? `Entrar como ${status.name}` : "Entrar na família"}
            </Button>
            <p className="mt-3 text-xs text-muted">Código do convite: {code}</p>
          </form>
        )}
      </div>
    </main>
  );
}
