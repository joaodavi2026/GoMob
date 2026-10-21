"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { LiveStatus } from "@/components/ui/indicators";
import { Dropdown } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { IntegrationState } from "@/types/transit";
import { initials, useMe, useSystemStatus } from "./hooks";
import { NAV_ITEMS } from "./nav-items";

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

function UserMenu() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: me } = useMe();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* the redirect below still clears the client state */
    }
    qc.clear();
    toast.success("Signed out.");
    router.replace("/login");
    router.refresh();
  }

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
        ...(me?.role === "ADMIN"
          ? [{ key: "admin", label: "Admin panel", icon: <ShieldCheck className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/admin") }]
          : []),
        { key: "logout", label: "Sign out", icon: <LogOut className="h-4 w-4" aria-hidden />, onSelect: logout, danger: true },
      ]}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label="Open profile menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-hover"
        >
          {initials(me?.name)}
        </button>
      )}
    />
  );
}

export function PassengerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary-light text-primary-pressed" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-5 pb-5 text-xs text-muted">Academic demonstration project</p>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/home" className="flex items-center lg:invisible" aria-label="GoMob home">
              <Logo variant="mark" priority className="h-9 w-9" />
              <span className="ml-2 text-lg font-bold tracking-tight text-ink">
                Go<span className="text-primary">Mob</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <SourceIndicator />
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className={cn("h-6 w-6", active && "stroke-[2.5]")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
