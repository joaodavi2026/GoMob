"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-risk-high" aria-hidden />
      <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="max-w-sm text-muted">We could not load this page. Please try again.</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/home" className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold text-ink hover:bg-canvas">
          Go home
        </Link>
      </div>
    </main>
  );
}
