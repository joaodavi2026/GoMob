import { Logo } from "@/components/ui/logo";

/** Full-screen branded loading state. */
export function LoadingScreen({ label = "Loading GoMob" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white px-6">
      <Logo priority className="h-40 w-40 animate-pulse" />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-primary-light">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
