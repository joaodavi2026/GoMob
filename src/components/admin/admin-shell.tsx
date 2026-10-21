"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bus, FlaskConical, Gauge, LayoutDashboard, LogOut, Menu, Radio, Settings, Sparkles, X, Database } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { ScenarioView } from "@/features/admin/scenario";

const NAV = [
  { href: "/admin", label: "Overview", title: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/lines", label: "Bus Lines", title: "Bus Lines", icon: Bus },
  { href: "/admin/vehicles", label: "Live Vehicles", title: "Live Vehicles", icon: Radio },
  { href: "/admin/intelligence", label: "Intelligence", title: "Intelligence", icon: Gauge },
  { href: "/admin/predictions", label: "Predictions", title: "Predictions", icon: Sparkles },
  { href: "/admin/sources", label: "Data Sources", title: "Data Sources", icon: Database },
  { href: "/admin/demo", label: "Demo Control", title: "Demo Control Center", icon: FlaskConical },
  { href: "/admin/settings", label: "System Settings", title: "System Settings", icon: Settings },
] as const;

function isActive(pathname: string, item: (typeof NAV)[number]) {
  return "exact" in item && item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AdminShell({ user, mode, children }: { user: { name: string }; mode: "LIVE" | "DEMO"; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o drawer ao navegar
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const scenario = useQuery({
    queryKey: ["admin", "demo"],
    queryFn: () => apiFetch<{ state: ScenarioView }>("/api/admin/demo"),
    refetchInterval: 15_000,
    enabled: mode === "DEMO",
  });

  const current = NAV.find((n) => isActive(pathname, n)) ?? NAV[0];
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "A";

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const nav = (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              active ? "bg-primary-light text-primary-pressed" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const modeBox = (
    <div className="rounded-xl border border-border bg-canvas p-3 text-xs">
      <div className="flex items-center gap-2 font-semibold text-ink">
        <Activity className="h-4 w-4 text-primary" aria-hidden />
        Operating mode
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge tone={mode === "LIVE" ? "low" : "primary"}>{mode === "LIVE" ? "LIVE MODE" : "DEMO MODE"}</Badge>
      </div>
      {mode === "DEMO" && <p className="mt-2 text-muted">Deterministic demonstration data. Not official.</p>}
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border bg-white p-4 lg:flex">
        <Link href="/admin" aria-label="GoMob admin home" className="px-1">
          <Logo className="h-16 w-auto" priority />
        </Link>
        {nav}
        <div className="mt-auto">{modeBox}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <Logo className="h-14 w-auto" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-canvas">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <div className="mt-auto">{modeBox}</div>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur lg:px-8">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-canvas lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{current.title}</h1>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge tone={mode === "LIVE" ? "low" : "primary"}>{mode === "LIVE" ? "LIVE" : "DEMO"}</Badge>
            {mode === "DEMO" && scenario.data && <Badge tone="neutral">Scenario {scenario.data.state.title.replace("Scenario ", "").split(" — ")[0]}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initials}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{user.name}</span>
            <button
              onClick={logout}
              disabled={loggingOut}
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-canvas hover:text-ink disabled:opacity-60"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
