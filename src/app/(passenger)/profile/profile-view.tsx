"use client";

import { useEffect, useState } from "react";
import { PlanTag } from "@/features/premium/plan-tag";
import { PremiumTeaser } from "@/features/premium/premium-teaser";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFavorites } from "@/features/favorites/use-favorites";
import { Check, GraduationCap, Heart, Pencil, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { initials, useMe } from "@/components/layout/hooks";

const PREFS_KEY = "gomob.prefs.v1";
type Prefs = { autoLocate: boolean };
const DEFAULT_PREFS: Prefs = { autoLocate: false };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "Não disponível";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Não disponível" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function ProfileView() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const favs = useFavorites();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    // Hydrate convenience preferences from localStorage after mount (SSR-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadPrefs());
  }, []);

  function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: preference only lasts for this visit */
    }
  }

  const save = useMutation({
    mutationFn: (newName: string) => apiFetch<unknown>("/api/profile", { method: "PATCH", body: JSON.stringify({ name: newName }) }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Nome de exibição atualizado.");
      qc.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
    },
    onError: () => toast.error("Não foi possível atualizar seu nome. Tente novamente."),
  });

  function startEdit() {
    setName(me.data?.name ?? "");
    setNameError(undefined);
    setEditing(true);
  }
  function submitName(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (v.length < 2) return setNameError("O nome precisa ter pelo menos 2 caracteres.");
    if (v.length > 60) return setNameError("O nome pode ter no máximo 60 caracteres.");
    setNameError(undefined);
    if (v === me.data?.name) return setEditing(false);
    save.mutate(v);
  }

  const user = me.data;
  const favCount = favs.data?.length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="pt-2 text-[30px] leading-tight tracking-tight">
        <span className="font-light text-muted">Seu</span> <span className="font-extrabold">perfil</span>
      </h1>
      <PremiumTeaser />

      {me.isPending ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : me.isError || !user ? (
        <ErrorState message="Não foi possível carregar seu perfil agora." onRetry={() => me.refetch()} />
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-pressed text-xl font-bold text-white ring-4 ring-primary-light" aria-hidden>
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              {editing ? (
                <form onSubmit={submitName} className="flex items-start gap-2">
                  <Input label="Nome de exibição" value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={60} autoFocus />
                  <div className="mt-7 flex gap-1">
                    <Button type="submit" size="icon" aria-label="Salvar nome" loading={save.isPending}>
                      {!save.isPending && <Check className="h-4 w-4" aria-hidden />}
                    </Button>
                    <Button type="button" variant="secondary" size="icon" aria-label="Cancelar edição" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-xl font-bold">{user.name}</p>
                  <PlanTag />
                  <Button variant="ghost" size="icon" onClick={startEdit} aria-label="Editar nome de exibição">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>

          <dl className="mt-4">
            <Row label="E-mail">{user.email}</Row>
            <Row label="Tipo de conta">
              <Badge tone="primary">{user.role === "ADMIN" ? "Administrador" : "Passageiro"}</Badge>
            </Row>
            <Row label="Membro desde">{formatDate(user.createdAt)}</Row>
            <Row label="Viagens favoritas">
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-primary" aria-hidden />
                {favs.isPending ? "..." : favs.isError ? "Indisponível" : favCount}
              </span>
            </Row>
          </dl>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Preferências</h2>
        <p className="mb-2 text-sm text-muted">Salvas apenas neste dispositivo, por conveniência.</p>
        {(
          [
            ["autoLocate", "Usar minha localização no Início", "Preenche a origem com sua posição atual ao abrir o Início (pede permissão)."],
          ] as const
        ).map(([key, title, desc]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4 border-b border-border py-3 last:border-0">
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted">{desc}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={prefs[key]}
              onChange={(e) => updatePref(key, e.target.checked)}
              className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-border transition-colors checked:bg-primary [&::before]:m-0.5 [&::before]:block [&::before]:h-4 [&::before]:w-4 [&::before]:rounded-full [&::before]:bg-white [&::before]:transition-transform [&::before]:content-[''] checked:[&::before]:translate-x-4"
            />
          </label>
        ))}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">Sobre o GoMob</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          GoMob — Mobilidade Urbana Inteligente. Este é um projeto acadêmico de demonstração que explora rotas inteligentes de ônibus,
          posições de veículos ao vivo e estimativas de risco de lotação em São Paulo.
        </p>
        <p className="mt-2 text-sm text-muted">
          Alguns números podem vir de dados de demonstração simulados e sempre são identificados como tal. O risco de lotação é uma estimativa, não uma medição oficial.
        </p>
      </Card>
    </div>
  );
}
