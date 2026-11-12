import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { operatingMode } from "@/features/admin/weights";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: "Painel administrativo" };
export const dynamic = "force-dynamic";

/** Acesso aberto (sem login) para a apresentação: o visitante usa a sessão aberta. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <AdminShell user={{ name: session.name || "Administrador" }} mode={operatingMode()}>
      {children}
    </AdminShell>
  );
}
