"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, GraduationCap, Heart, LogOut, Pencil, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, ErrorState, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlay";
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
  if (!iso) return "Not available";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Not available" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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
  const favs = useQuery({ queryKey: ["favorites"], retry: 0, queryFn: () => apiFetch<{ favorites: unknown[] }>("/api/favorites") });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
      toast.success("Display name updated.");
      qc.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
    },
    onError: () => toast.error("Could not update your name. Please try again."),
  });

  function startEdit() {
    setName(me.data?.name ?? "");
    setNameError(undefined);
    setEditing(true);
  }
  function submitName(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (v.length < 2) return setNameError("Name must have at least 2 characters.");
    if (v.length > 60) return setNameError("Name must have at most 60 characters.");
    setNameError(undefined);
    if (v === me.data?.name) return setEditing(false);
    save.mutate(v);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* continue to login regardless */
    }
    qc.clear();
    router.replace("/login");
    router.refresh();
  }

  const user = me.data;
  const favCount = favs.data?.favorites.length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>

      {me.isPending ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : me.isError || !user ? (
        <ErrorState message="We could not load your profile right now." onRetry={() => me.refetch()} />
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white shadow-soft" aria-hidden>
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              {editing ? (
                <form onSubmit={submitName} className="flex items-start gap-2">
                  <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={60} autoFocus />
                  <div className="mt-7 flex gap-1">
                    <Button type="submit" size="icon" aria-label="Save name" loading={save.isPending}>
                      {!save.isPending && <Check className="h-4 w-4" aria-hidden />}
                    </Button>
                    <Button type="button" variant="secondary" size="icon" aria-label="Cancel editing" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-xl font-bold">{user.name}</p>
                  <Button variant="ghost" size="icon" onClick={startEdit} aria-label="Edit display name">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>

          <dl className="mt-4">
            <Row label="Email">{user.email}</Row>
            <Row label="Role">
              <Badge tone="primary">{user.role === "ADMIN" ? "Administrator" : "Passenger"}</Badge>
            </Row>
            <Row label="Member since">{formatDate(user.createdAt)}</Row>
            <Row label="Favorite journeys">
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-primary" aria-hidden />
                {favs.isPending ? "..." : favs.isError ? "Unavailable" : favCount}
              </span>
            </Row>
          </dl>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="mb-2 text-sm text-muted">Stored only on this device, for convenience.</p>
        {(
          [
            ["autoLocate", "Use my location on Home", "Fill the origin with your current position when you open Home (asks for permission)."],
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
          <h2 className="text-lg font-semibold">About GoMob</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          GoMob — Intelligent Urban Mobility. Go smarter. Ride better. This is an academic demonstration project that explores smart bus routes,
          live vehicle positions and crowding-risk estimates for São Paulo.
        </p>
        <p className="mt-2 text-sm text-muted">
          Some figures may come from simulated demonstration data and are always labelled as such. Crowding risk is an estimate, not an official measurement.
        </p>
      </Card>

      <Button variant="secondary" size="lg" className="w-full text-risk-high" onClick={() => setConfirmLogout(true)}>
        <LogOut className="h-5 w-5" aria-hidden />
        Sign out
      </Button>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logout}
        loading={loggingOut}
        title="Sign out of GoMob?"
        description="You will need to sign in again to see your favorites and routes."
        confirmLabel="Sign out"
        destructive
      />
    </div>
  );
}
