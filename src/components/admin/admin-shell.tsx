"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bus, FlaskConical, Gauge, LayoutDashboard, Menu, Smartphone, Radio, Settings, Sparkles, X, Database } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { ScenarioView } from "@/features/admin/scenario";

const NAV = [
  { href: "/admin", label: "Visão geral", title: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/lines", label: "Linhas", title: "Linhas de ônibus", icon: Bus },
  { href: "/admin/vehicles", label: "Veículos", title: "Veículos ao vivo", icon: Radio },
  { href: "/admin/intelligence", label: "Inteligência", title: "Inteligência", icon: Gauge },
  { href: "/admin/predictions", label: "Previsões", title: "Previsões", icon: Sparkles },
  { href: "/admin/sources", label: "Fontes de dados", title: "Fontes de dados", icon: Database },
  { href: "/admin/demo", label: "Demonstração", title: "Central de demonstração", icon: FlaskConical },
  { href: "/admin/settings", label: "Configurações", title: "Configurações do sistema", icon: Settings },
] as const;

function isActive(pathname: string, item: (typeof NAV)[number]) {
  return "exact" in item && item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AdminShell({ user, mode, children }: { user: { name: string }; mode: "LIVE" | "DEMO"; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  const nav = (
    <nav aria-label="Navegação do painel administrativo" className="flex flex-col gap-1">
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
        Modo de operação
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge tone={mode === "LIVE" ? "low" : "primary"}>{mode === "LIVE" ? "MODO AO VIVO" : "MODO DEMONSTRAÇÃO"}</Badge>
      </div>
      {mode === "DEMO" && <p className="mt-2 text-muted">Dados de demonstração determinísticos. Não oficiais.</p>}
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border bg-white p-4 lg:flex">
        <Link href="/admin" aria-label="Início do painel administrativo GoMob" className="px-1">
          <Logo className="h-16 w-auto" priority />
        </Link>
        {nav}
        <div className="mt-auto">{modeBox}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel administrativo">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <Logo className="h-14 w-auto" />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-canvas">
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
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-canvas lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{current.title}</h1>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge tone={mode === "LIVE" ? "low" : "primary"}>{mode === "LIVE" ? "AO VIVO" : "DEMONSTRAÇÃO"}</Badge>
            {mode === "DEMO" && scenario.data && <Badge tone="neutral">Cenário {scenario.data.state.title.replace("Cenário ", "").split(" — ")[0]}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initials}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{user.name}</span>
            <Link
              href="/home"
              aria-label="Voltar ao app"
              className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-canvas hover:text-ink"
            >
              <Smartphone className="h-5 w-5" aria-hidden /> <span className="hidden sm:inline">Voltar ao app</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
