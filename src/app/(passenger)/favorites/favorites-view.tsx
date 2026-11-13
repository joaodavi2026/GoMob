"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, Search, Star, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { FAVORITES_KEY, useFavorites, type Favorite } from "@/features/favorites/use-favorites";

function searchHref(f: Favorite) {
  const enc = encodeURIComponent;
  const o = `${f.originLatitude},${f.originLongitude},${enc(f.originLabel)}`;
  const d = `${f.destinationLatitude},${f.destinationLongitude},${enc(f.destinationLabel)}`;
  return `/routes?o=${o}&d=${d}`;
}

export function FavoritesView() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Favorite | null>(null);
  const [nickname, setNickname] = useState("");
  const [removing, setRemoving] = useState<Favorite | null>(null);

  const list = useFavorites();

  const rename = useMutation({
    mutationFn: (v: { id: string; nickname: string }) =>
      apiFetch(`/api/favorites/${v.id}`, { method: "PATCH", body: JSON.stringify({ nickname: v.nickname }) }),
    onSuccess: () => {
      toast.success("Viagem atualizada.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/favorites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Viagem removida.");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl pb-4 pt-2 md:py-10">
      <h1 className="text-[30px] leading-tight tracking-tight">
        <span className="font-light text-muted">Viagens</span> <span className="font-extrabold">salvas</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Rotas salvas, prontas para buscar de novo.</p>

      <div className="mt-6 space-y-3">
        {list.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        {list.isError && (
          <EmptyState
            icon={<Star className="h-6 w-6" aria-hidden />}
            title="Favoritos indisponíveis"
            description="As viagens salvas precisam do banco de dados. Configure DATABASE_URL para guardar suas rotas aqui."
            action={{ label: "Tentar novamente", onClick: () => list.refetch() }}
          />
        )}
        {list.data?.length === 0 && (
          <EmptyState
            icon={<Star className="h-8 w-8" aria-hidden />}
            title="Nenhuma viagem salva ainda"
            description="Encontre uma rota e toque em “Salvar rota” para guardá-la aqui."
          />
        )}
        {list.data?.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{f.nickname}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                  <span className="truncate">{f.originLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{f.destinationLabel}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label={`Editar ${f.nickname}`} onClick={() => { setEditing(f); setNickname(f.nickname); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Remover ${f.nickname}`} onClick={() => setRemoving(f)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Link href={searchHref(f)} className="tap mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-night text-sm font-semibold text-white">
              <Search className="h-4 w-4" aria-hidden /> Buscar de novo
            </Link>
          </Card>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar viagem">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing && nickname.trim()) rename.mutate({ id: editing.id, nickname: nickname.trim() });
          }}
        >
          <Input label="Nome" value={nickname} maxLength={60} onChange={(e) => setNickname(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" loading={rename.isPending} disabled={!nickname.trim()}>Salvar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title="Remover esta viagem?"
        description={removing ? `“${removing.nickname}” será removida dos seus favoritos.` : undefined}
        confirmLabel="Remover"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}
