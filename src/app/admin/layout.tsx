import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { operatingMode } from "@/features/admin/weights";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Checagem SERVER-SIDE: nunca confiar apenas no frontend.
  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "ADMIN") redirect("/home");

  return (
    <AdminShell user={{ name: session.name || "Administrator" }} mode={operatingMode()}>
      {children}
    </AdminShell>
  );
}
