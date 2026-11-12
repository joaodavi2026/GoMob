import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <Logo priority className="h-32 w-32" />
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Erro 404</p>
      <h1 className="text-3xl font-bold text-ink">Esta parada não está no nosso mapa</h1>
      <p className="max-w-sm text-muted">A página que você procura não existe ou foi movida.</p>
      <Link href="/home" className="mt-2 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-soft hover:bg-primary-hover">
        Voltar ao início
      </Link>
    </main>
  );
}
