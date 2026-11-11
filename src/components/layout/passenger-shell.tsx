"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Accessibility, ShieldCheck, User as UserIcon } from "lucide-react";
import { ReadScreenButton } from "@/features/a11y/a11y";
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
  let label = "Status unavailable";
  if (isPending) {
    state = "UPDATING";
    label = "Checking data";
  } else if (data) {
    if (data.mode === "DEMO") {
      state = "DEMO";
      label = "Demo data";
    } else {
      const states = data.integrations.map((i) => i.state);
      if (states.includes("UNAVAILABLE")) {
        state = "UNAVAILABLE";
        label = "Live data unavailable";
      } else if (states.includes("STALE")) {
        state = "STALE";
        label = "Live data outdated";
      } else {
        state = "CONNECTED";
        label = "Live SPTrans data";
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

  return (
    <Dropdown
      header={
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{me?.name ?? "GoMob user"}</p>
          {me?.email && <p className="truncate text-xs text-muted">{me.email}</p>}
        </div>
      }
      items={[
        { key: "profile", label: "Profile", icon: <UserIcon className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/profile") },
        { key: "a11y", label: "Acessibilidade", icon: <Accessibility className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/accessibility") },
        ...(me?.role === "ADMIN"
          ? [{ key: "admin", label: "Admin panel", icon: <ShieldCheck className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/admin") }]
          : []),
      ]}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label="Open profile menu"
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

/** Cápsula de navegação flutuante (mobile). O item ativo vira uma pílula laranja com rótulo. */
function FloatingNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="pointer-events-auto mx-auto flex max-w-[420px] items-center justify-between rounded-full bg-night/95 p-1.5 shadow-float ring-1 ring-white/5 backdrop-blur-md">
        {NAV_ITEMS.filter((n) => n.mobile).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "tap flex h-12 items-center rounded-full transition-all duration-300",
                  active ? "gap-2 bg-primary pl-1.5 pr-4 text-white" : "w-12 justify-center text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <span className={cn("flex items-center justify-center rounded-full", active && "h-9 w-9 bg-white text-primary")}>
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} aria-hidden />
                </span>
                {active && <span className="truncate text-sm font-semibold">{label}</span>}
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
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-white lg:flex" aria-label="Primary">
        <Link href="/home" className="flex items-center justify-center px-4 pt-5" aria-label="GoMob home">
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
        <p className="mt-auto px-5 pb-5 text-xs text-muted">Academic demonstration project</p>
      </aside>

      <div className="lg:pl-60">
        <header className={cn("sticky top-0 z-30 bg-canvas/85 backdrop-blur-md lg:border-b lg:border-border lg:bg-white/90", bleed && "hidden lg:block")}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-6 lg:h-14">
            <div className="flex min-w-0 items-center gap-2.5 lg:invisible">
              <Link href="/home" aria-label="GoMob home" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
                <Logo variant="mark" priority className="h-7 w-7" />
              </Link>
              <span className="hidden truncate text-xl font-extrabold tracking-tight text-ink min-[420px]:inline">
                Go<span className="text-primary">Mob</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
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
