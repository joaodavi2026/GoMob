"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, Search, Star, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

type Favorite = {
  id: string;
  nickname: string;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
};

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

  const list = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const data = await apiFetch<{ favorites?: Favorite[]; items?: Favorite[] }>("/api/favorites");
      return data.favorites ?? data.items ?? [];
    },
  });

  const rename = useMutation({
    mutationFn: (v: { id: string; nickname: string }) =>
      apiFetch(`/api/favorites/${v.id}`, { method: "PATCH", body: JSON.stringify({ nickname: v.nickname }) }),
    onSuccess: () => {
      toast.success("Journey updated.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/favorites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Journey removed.");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">Your favorite journeys</h1>
      <p className="mt-1 text-sm text-muted">Saved routes, ready to search again.</p>

      <div className="mt-6 space-y-3">
        {list.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        {list.isError && <ErrorState message="We couldn't load your favorites." onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && (
          <EmptyState
            icon={<Star className="h-8 w-8" aria-hidden />}
            title="No saved journeys yet"
            description="Find a route and tap “Save route” to keep it here."
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
                <Button variant="ghost" size="icon" aria-label={`Edit ${f.nickname}`} onClick={() => { setEditing(f); setNickname(f.nickname); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${f.nickname}`} onClick={() => setRemoving(f)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Link href={searchHref(f)} className="mt-3 block">
              <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                <Search className="h-4 w-4" /> Search again
              </Button>
            </Link>
          </Card>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit journey">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing && nickname.trim()) rename.mutate({ id: editing.id, nickname: nickname.trim() });
          }}
        >
          <Input label="Name" value={nickname} maxLength={60} onChange={(e) => setNickname(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={rename.isPending} disabled={!nickname.trim()}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title="Remove this journey?"
        description={removing ? `“${removing.nickname}” will be deleted from your favorites.` : undefined}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}
