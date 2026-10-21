import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { getSession, type SessionPayload } from "@/server/auth/session";
import { BrandPanel, RouteArt } from "./brand-panel";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

async function currentSession(): Promise<SessionPayload | null> {
  try {
    return await getSession();
  } catch {
    return null; // misconfigured secret etc.: just show the form
  }
}

export default async function LoginPage() {
  const session = await currentSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/home");

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      <BrandPanel />

      <main className="flex flex-col items-center justify-center px-5 py-8 sm:px-10">
        {/* Mobile header: orange band with reduced illustration */}
        <div className="relative -mx-5 -mt-8 mb-8 w-[calc(100%+2.5rem)] overflow-hidden bg-primary px-5 pb-6 pt-8 text-center text-white sm:-mx-10 sm:w-[calc(100%+5rem)] lg:hidden">
          <RouteArt className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80" />
          <div className="relative flex flex-col items-center">
            <Logo priority tone="white" className="h-28 w-28" />
            <p className="mt-1 text-sm font-medium text-white/95">Move smarter. Live better.</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Welcome to GoMob</h1>
          <p className="mb-7 mt-2 text-muted">Sign in to continue your journey.</p>
          <LoginForm />
        </div>

        <p className="mt-10 text-xs text-muted">GoMob — Intelligent Urban Mobility</p>
      </main>
    </div>
  );
}
