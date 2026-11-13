"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Accessibility, Crown, ShieldCheck, User as UserIcon } from "lucide-react";
import { AdsProvider } from "@/features/ads/ads";
import { usePlan } from "@/features/premium/use-plan";
import { ReadScreenButton } from "@/features/a11y/a11y";
import { CompassIcon, HeartIcon, HomeIcon, LiveIcon, RouteIcon } from "@/components/icons/animated-icons";
import { Logo } from "@/components/ui/logo";
import { LiveStatus } from "@/components/ui/indicators";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import type { IntegrationState } from "@/types/transit";
import { initials, useMe, useSystemStatus } from "./hooks";
import { FULL_BLEED_MOBILE, NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Data source indicator driven by GET /api/system/status (tolerates failure). */
function SourceIndicator() {
  const { data, isError, isPending } = useSystemStatus();
  let state: IntegrationState = "UNAVAILABLE";
  let label = "Status indisponível";
  if (isPending) {
    state = "UPDATING";
    label = "Verificando dados";
  } else if (data) {
    if (data.mode === "DEMO") {
      state = "DEMO";
      label = "Dados de demonstração";
    } else {
      // só fontes configuradas contam (ex.: o mapa base não é uma fonte de dados ao vivo)
      const states = data.integrations.filter((i) => i.configured).map((i) => i.state);
      if (states.includes("UNAVAILABLE")) {
        state = "UNAVAILABLE";
        label = "Dados ao vivo indisponíveis";
      } else if (states.includes("STALE")) {
        state = "STALE";
        label = "Dados ao vivo desatualizados";
      } else {
        state = "CONNECTED";
        label = "Dados ao vivo SPTrans";
      }
    }
  } else if (isError) {
    state = "UNAVAILABLE";
  }
  return <LiveStatus state={state} label={label} hideLabelOnMobile />;
}


export function UserMenu({ className }: { className?: string }) {
  const router = useRouter();
  const { data: me } = useMe();
  const { premium } = usePlan();

  return (
    <Dropdown
      header={
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{me?.name ?? "Usuário GoMob"}</p>
          {me?.email && <p className="truncate text-xs text-muted">{me.email}</p>}
        </div>
      }
      items={[
        { key: "profile", label: "Perfil", icon: <UserIcon className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/profile") },
        { key: "premium", label: premium ? "Premium ativo" : "Assinar Premium", icon: <Crown className="h-4 w-4 text-primary" aria-hidden />, onSelect: () => router.push("/premium") },
        { key: "a11y", label: "Acessibilidade", icon: <Accessibility className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/accessibility") },
        ...(me?.role === "ADMIN"
          ? [{ key: "admin", label: "Painel administrativo", icon: <ShieldCheck className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/admin") }]
          : []),
      ]}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label="Abrir menu do perfil"
          className={cn(
            "tap flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-pressed text-sm font-bold text-white ring-[3px] ring-white shadow-soft",
            className,
          )}
        >
          {initials(me?.name)}
        </button>
      )}
    />
  );
}

/** Ícones animados da cápsula (o desktop continua com os ícones estáticos de NAV_ITEMS). */
const NAV_ANIM: Record<string, (p: { className?: string }) => React.ReactElement> = {
  "/home": HomeIcon,
  "/network": CompassIcon,
  "/routes": RouteIcon,
  "/map": LiveIcon,
  "/favorites": HeartIcon,
};

/** Cápsula de navegação flutuante (mobile). O item ativo vira uma pílula laranja com rótulo. */
function FloatingNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Principal" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="pointer-events-auto mx-auto flex max-w-[420px] items-center justify-between rounded-full bg-night/95 p-1.5 shadow-float ring-1 ring-white/5 backdrop-blur-md">
        {NAV_ITEMS.filter((n) => n.mobile).map(({ href, label, icon: StaticIcon }) => {
          // Rotas não está na barra: a busca começa na Início, então ela fica destacada
          const active = isActive(pathname, href) || (href === "/home" && isActive(pathname, "/routes"));
          const Icon = NAV_ANIM[href] ?? StaticIcon;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                data-still={active ? undefined : ""}
                className={cn(
                  "tap flex h-12 items-center rounded-full transition-all duration-300",
                  active ? "gap-2 bg-primary pl-1.5 pr-3.5 text-white" : "w-11 justify-center text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <span className={cn("flex items-center justify-center rounded-full", active && "h-9 w-9 bg-white text-primary")}>
                  <Icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.4]")} />
                </span>
                {active && <span className="truncate text-sm font-semibold max-[359px]:sr-only">{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PassengerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bleed = FULL_BLEED_MOBILE.some((p) => isActive(pathname, p));

  return (
    <AdsProvider>
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-white lg:flex" aria-label="Principal">
        <Link href="/home" className="flex items-center justify-center px-4 pt-5" aria-label="Início do GoMob">
          <Logo priority className="h-28 w-28" />
        </Link>
        <nav className="mt-4 flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
                  active ? "bg-night text-white" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-5 pb-5 text-xs text-muted">Projeto acadêmico de demonstração</p>
      </aside>

      <div className="lg:pl-60">
        <header className={cn("sticky top-0 z-30 bg-canvas/85 backdrop-blur-md lg:border-b lg:border-border lg:bg-white/90", bleed && "hidden lg:block")}>
          <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-2 sm:px-6 lg:min-h-14 lg:py-0">
            <div className="flex min-w-0 items-center gap-2.5 lg:invisible">
              <Link href="/home" aria-label="Início do GoMob" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
                <Logo variant="mark" priority className="h-7 w-7" />
              </Link>
              <span className="hidden truncate text-xl font-extrabold tracking-tight text-ink min-[420px]:inline">
                Go<span className="text-primary">Mob</span>
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
              <SourceIndicator />
              <AccessibilityButton />
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="main" className={cn("mx-auto w-full max-w-6xl px-5 pb-32 pt-2 sm:px-6 lg:pb-10 lg:pt-5", bleed && "pt-0 lg:pt-5")}>
          {children}
        </main>
      </div>

      <ReadScreenButton />
      <FloatingNav pathname={pathname} />
    </div>
    </AdsProvider>
  );
}

/** Atalho sempre visível para a área de Acessibilidade (rótulo escrito, não só ícone). */
export function AccessibilityButton({ className }: { className?: string }) {
  return (
    <Link
      href="/accessibility"
      aria-label="Acessibilidade"
      className={cn("tap flex h-11 items-center gap-1.5 rounded-full bg-night pl-2.5 pr-3.5 text-xs font-bold text-white shadow-soft", className)}
    >
      <Accessibility className="h-5 w-5 text-primary" aria-hidden />
      <span>Acessibilidade</span>
    </Link>
  );
}
