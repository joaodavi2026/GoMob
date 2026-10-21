import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <Logo priority className="h-32 w-32" />
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Error 404</p>
      <h1 className="text-3xl font-bold text-ink">This stop is not on our map</h1>
      <p className="max-w-sm text-muted">The page you are looking for does not exist or was moved.</p>
      <Link href="/home" className="mt-2 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-soft hover:bg-primary-hover">
        Back to home
      </Link>
    </main>
  );
}
